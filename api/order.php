<?php

header('Content-Type: application/json');

$dsn = 'mysql:host=localhost;dbname=kocenpto;charset=utf8mb4';
$db_user = 'root';
$db_pass = '';

try {
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// --- HELPER FUNCTIONS ---
function handleError($message) {
    http_response_code(500);
    echo json_encode(['error' => $message]);
    exit;
}

function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

// --- ROUTING AND ENDPOINT LOGIC ---
$requestMethod = $_SERVER['REQUEST_METHOD'];
$endpoint = $_GET['endpoint'] ?? null;

if (!$endpoint) {
    sendJsonResponse(['message' => 'Endpoint not specified.'], 400);
}

// ------------------- GET /api/admin/orders -------------------
if ($endpoint === '/api/admin/orders' && $requestMethod === 'GET') {
    $tab = $_GET['tab'] ?? 'all';
    $status = $_GET['status'] ?? 'All';

    $normalOrdersQuery = "SELECT orders.id, orders.user_id, orders.status, orders.created_at,
                           users.first_name, users.last_name, schools.school_name, schools.image as school_image
                           FROM orders
                           LEFT JOIN users ON orders.user_id = users.id
                           LEFT JOIN schools ON users.school_id = schools.id";

    $customOrdersQuery = "SELECT custom_orders.id, custom_orders.user_id, custom_orders.status, custom_orders.created_at,
                           users.first_name, users.last_name, schools.school_name, schools.image as school_image,
                           (SELECT COUNT(*) FROM custom_order_items WHERE custom_order_items.custom_order_id = custom_orders.id) as items_count
                           FROM custom_orders
                           LEFT JOIN users ON custom_orders.user_id = users.id
                           LEFT JOIN schools ON users.school_id = schools.id";

    $normalOrdersWhere = "";
    $customOrdersWhere = "";

    if ($tab === 'orders') {
        $normalOrdersWhere = ($status !== 'All') ? " WHERE orders.status = :status" : " WHERE orders.status != 'delivered'";
        $customOrdersQuery = '';
    } elseif ($tab === 'custom') {
        $customOrdersWhere = ($status !== 'All') ? " WHERE custom_orders.status = :status" : " WHERE custom_orders.status != 'delivered'";
        $normalOrdersQuery = '';
    } elseif ($tab === 'completed') {
        $normalOrdersWhere = " WHERE orders.status = 'delivered'";
        $customOrdersWhere = " WHERE custom_orders.status = 'delivered'";
    } else {
        $normalOrdersWhere = " WHERE orders.status != 'delivered'";
        $customOrdersWhere = " WHERE custom_orders.status != 'delivered'";
    }

    $orders = [];

    if (!empty($normalOrdersQuery)) {
        $stmt = $pdo->prepare($normalOrdersQuery . $normalOrdersWhere . " ORDER BY orders.created_at DESC");
        if ($status !== 'All' && $tab !== 'completed' && $tab !== 'all') {
            $stmt->bindValue(':status', $status, PDO::PARAM_STR);
        }
        $stmt->execute();
        $normalOrders = $stmt->fetchAll();
        foreach ($normalOrders as &$order) {
            $order['is_custom'] = false;
        }
        $orders = array_merge($orders, $normalOrders);
    }

    if (!empty($customOrdersQuery)) {
        $stmt = $pdo->prepare($customOrdersQuery . $customOrdersWhere . " ORDER BY custom_orders.created_at DESC");
        if ($status !== 'All' && $tab !== 'completed' && $tab !== 'all') {
            $stmt->bindValue(':status', $status, PDO::PARAM_STR);
        }
        $stmt->execute();
        $customOrders = $stmt->fetchAll();
        foreach ($customOrders as &$order) {
            $order['is_custom'] = true;
        }
        $orders = array_merge($orders, $customOrders);
    }

    usort($orders, function ($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });

    $normalOrdersCount = $pdo->query("SELECT COUNT(*) FROM orders WHERE status != 'delivered'")->fetchColumn();
    $customOrdersCount = $pdo->query("SELECT COUNT(*) FROM custom_orders WHERE status != 'delivered'")->fetchColumn();
    $completedOrdersCount = $pdo->query("SELECT COUNT(*) FROM orders WHERE status = 'delivered'")->fetchColumn() +
                            $pdo->query("SELECT COUNT(*) FROM custom_orders WHERE status = 'delivered'")->fetchColumn();

    sendJsonResponse([
        'orders' => array_values($orders),
        'tab' => $tab,
        'status' => $status,
        'normalOrdersCount' => (int)$normalOrdersCount,
        'customOrdersCount' => (int)$customOrdersCount,
        'allOrdersCount' => (int)$normalOrdersCount + (int)$customOrdersCount,
        'completedOrdersCount' => (int)$completedOrdersCount,
    ]);
}

// ------------------- GET /api/admin/custom-orders/{id}/details -------------------
elseif (preg_match('/^\/api\/admin\/custom-orders\/(\d+)\/details$/', $endpoint, $matches) && $requestMethod === 'GET') {
    $orderId = (int)$matches[1];

    $stmt = $pdo->prepare("SELECT custom_orders.*, users.first_name, users.last_name, schools.school_name, schools.image as school_image
                           FROM custom_orders
                           LEFT JOIN users ON custom_orders.user_id = users.id
                           LEFT JOIN schools ON users.school_id = schools.id
                           WHERE custom_orders.id = :id");
    $stmt->execute(['id' => $orderId]);
    $order = $stmt->fetch();

    if (!$order) sendJsonResponse(['message' => 'Order not found'], 404);

    $stmt = $pdo->prepare("SELECT * FROM custom_order_items WHERE custom_order_id = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    $items = $stmt->fetchAll();

    sendJsonResponse(['order' => $order, 'items' => $items]);
}

// ------------------- POST /api/admin/custom-order-items/{id}/toggle-gathered -------------------
elseif (preg_match('/^\/api\/admin\/custom-order-items\/(\d+)\/toggle-gathered$/', $endpoint, $matches) && $requestMethod === 'POST') {
    $itemId = (int)$matches[1];
    $input = json_decode(file_get_contents('php://input'), true);
    $gathered = isset($input['gathered']) ? (int)$input['gathered'] : 0;

    $stmt = $pdo->prepare("UPDATE custom_order_items SET gathered = :gathered WHERE id = :id");
    $stmt->execute(['gathered' => $gathered, 'id' => $itemId]);

    sendJsonResponse(['success' => true]);
}

// ------------------- POST /api/admin/update-order-status -------------------
elseif ($endpoint === '/api/admin/update-order-status' && $requestMethod === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['order_id'], $input['status'], $input['type'])) {
        sendJsonResponse(['error' => 'Missing required parameters.'], 400);
    }

    $orderId = $input['order_id'];
    $status = $input['status'];
    $type = $input['type'];

    if ($type === 'normal') {
        $stmt = $pdo->prepare("UPDATE orders SET status = :status WHERE id = :id");
    } elseif ($type === 'custom') {
        $stmt = $pdo->prepare("UPDATE custom_orders SET status = :status WHERE id = :id");
    } else {
        sendJsonResponse(['error' => 'Invalid order type.'], 400);
    }

    try {
        $stmt->execute(['status' => $status, 'id' => $orderId]);
        sendJsonResponse(['success' => true, 'message' => 'Status updated successfully.']);
    } catch (PDOException $e) {
        handleError('Failed to update order status: ' . $e->getMessage());
    }
}

// ------------------- GET /api/admin/orders/{id}/details -------------------
elseif (preg_match('/^\/api\/admin\/orders\/(\d+)\/details$/', $endpoint, $matches) && $requestMethod === 'GET') {
    $orderId = (int)$matches[1];
    $search = $_GET['search'] ?? null;

    $stmt = $pdo->prepare("SELECT orders.*, users.first_name, users.last_name, schools.school_name, schools.image as school_image
                           FROM orders
                           LEFT JOIN users ON orders.user_id = users.id
                           LEFT JOIN schools ON users.school_id = schools.id
                           WHERE orders.id = :id");
    $stmt->execute(['id' => $orderId]);
    $order = $stmt->fetch();

    if (!$order) sendJsonResponse(['message' => 'Order not found'], 404);

    $itemsQuery = "SELECT order_details.id, order_details.quantity, order_details.price,
                   products.name, products.brand, products.unit, products.description, products.photo
                   FROM order_details
                   LEFT JOIN products ON order_details.product_id = products.id
                   WHERE order_details.order_id = :order_id";
    $params = ['order_id' => $orderId];

    if ($search) {
        $itemsQuery .= " AND (products.name LIKE :search OR products.brand LIKE :search OR products.description LIKE :search)";
        $params['search'] = '%' . $search . '%';
    }

    $stmt = $pdo->prepare($itemsQuery);
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    foreach ($items as &$item) {
        $item['gathered'] = false;
    }

    sendJsonResponse(['order' => $order, 'items' => $items]);
}

// ------------------- GET /api/admin/custom-orders/{id}/quotation -------------------
elseif (preg_match('/^\/api\/admin\/custom-orders\/(\d+)\/quotation$/', $endpoint, $matches) && $requestMethod === 'GET') {
    $orderId = (int)$matches[1];

    $stmt = $pdo->prepare("SELECT * FROM custom_orders WHERE id = :id");
    $stmt->execute(['id' => $orderId]);
    $order = $stmt->fetch();

    if (!$order) sendJsonResponse(['message' => 'Custom order not found'], 404);

    $stmt = $pdo->prepare("SELECT * FROM custom_order_items WHERE custom_order_id = :id");
    $stmt->execute(['id' => $orderId]);
    $items = $stmt->fetchAll();
    $order['items'] = $items;

    sendJsonResponse(['order' => $order]);
}

// ------------------- POST /api/admin/custom-orders/{id}/save-quotation-prices -------------------
elseif (preg_match('/^\/api\/admin\/custom-orders\/(\d+)\/save-quotation-prices$/', $endpoint, $matches) && $requestMethod === 'POST') {
    $orderId = (int)$matches[1];
    $input = json_decode(file_get_contents('php://input'), true);
    $pricesData = $input['prices'] ?? [];

    $pdo->beginTransaction();
    try {
        $totalPrice = 0;
        foreach ($pricesData as $itemId => $price) {
            $price = floatval($price);
            $stmt = $pdo->prepare("SELECT quantity FROM custom_order_items WHERE id = :id");
            $stmt->execute(['id' => $itemId]);
            $quantity = $stmt->fetchColumn();
            $totalPrice += $price * $quantity;

            $stmt = $pdo->prepare("UPDATE custom_order_items SET price = :price, total_price = :total_price WHERE id = :id");
            $stmt->execute(['price' => $price, 'total_price' => $price * $quantity, 'id' => $itemId]);
        }

        $stmt = $pdo->prepare("UPDATE custom_orders SET total_price = :total, status = 'quoted' WHERE id = :id");
        $stmt->execute(['total' => $totalPrice, 'id' => $orderId]);

        $pdo->commit();
        sendJsonResponse(['success' => true, 'message' => 'Prices saved and order status updated to quoted.']);
    } catch (PDOException $e) {
        $pdo->rollBack();
        handleError('Failed to save quotation prices: ' . $e->getMessage());
    }
}

// ------------------- GET /api/admin/custom-orders/{id}/gather -------------------
elseif (preg_match('/^\/api\/admin\/custom-orders\/(\d+)\/gather$/', $endpoint, $matches) && $requestMethod === 'GET') {
    $orderId = (int)$matches[1];
    $stmt = $pdo->prepare("SELECT * FROM custom_orders WHERE id = :id");
    $stmt->execute(['id' => $orderId]);
    $order = $stmt->fetch();

    if (!$order) sendJsonResponse(['message' => 'Custom order not found'], 404);

    if (strtolower($order['status']) === 'approved') {
        $stmt = $pdo->prepare("UPDATE custom_orders SET status = 'gathering' WHERE id = :id");
        $stmt->execute(['id' => $orderId]);
        $order['status'] = 'gathering';
    }

    $stmt = $pdo->prepare("SELECT * FROM custom_order_items WHERE custom_order_id = :id");
    $stmt->execute(['id' => $orderId]);
    $items = $stmt->fetchAll();
    $order['items'] = $items;

    sendJsonResponse(['order' => $order, 'items' => $items]);
}

// ------------------- Fallback for unmatched endpoints -------------------
else {
    sendJsonResponse(['message' => 'Endpoint not found.'], 404);
}

?>
