<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = 'localhost';
$db   = 'kocenpto';
$user = 'root';
$pass = 'teamvanguard';
$charset = 'utf8mb4';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
];

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset", $user, $pass, $options);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}

$action = $_GET['action'] ?? null;
$orderId = $_GET['orderId'] ?? null;
$orderType = $_GET['orderType'] ?? null;

if ($orderId !== null && $action === null) {
    $order = null;
    $items = [];

    if ($orderType === 'custom') {
        $stmt = $pdo->prepare("
            SELECT co.*, u.name AS user_full_name, u.phone_number, u.email,
                   s.address AS school_address, s.latitude AS school_latitude, s.longitude AS school_longitude
            FROM custom_orders co
            LEFT JOIN users u ON co.user_id = u.id
            LEFT JOIN schools s ON co.school_id = s.id
            WHERE co.id = ?
        ");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();

        if ($order) {
            $stmtItems = $pdo->prepare("SELECT * FROM custom_order_items WHERE custom_order_id = ?");
            $stmtItems->execute([$orderId]);
            $items = $stmtItems->fetchAll();

            // Structure user data
            $order['user'] = [
                'id' => $order['user_id'] ?? null,
                'name' => $order['user_full_name'] ?? 'N/A', // Use 'user_full_name' alias
                'first_name' => explode(' ', $order['user_full_name'])[0] ?? 'N/A', // Attempt to derive first name
                'last_name' => isset(explode(' ', $order['user_full_name'])[1]) ? implode(' ', array_slice(explode(' ', $order['user_full_name']), 1)) : 'N/A', // Attempt to derive last name
                'phone_number' => $order['phone_number'] ?? 'N/A',
                'email' => $order['email'] ?? 'N/A'
            ];

            // Structure delivery location. Prioritize school location if available.
            if (!empty($order['school_address']) && !empty($order['school_latitude']) && !empty($order['school_longitude'])) {
                $order['delivery_location'] = [
                    'address' => $order['school_address'],
                    'latitude' => (float)$order['school_latitude'], // Cast to float
                    'longitude' => (float)$order['school_longitude'] // Cast to float
                ];
            } elseif (isset($order['delivery_location'])) { // Fallback to delivery_location column if school data is missing
                   $decodedLocation = json_decode($order['delivery_location'], true);
                   if (json_last_error() === JSON_ERROR_NONE) {
                       $order['delivery_location'] = $decodedLocation;
                   } else {
                       $order['delivery_location'] = null; // Set to null if decoding fails
                   }
            } else {
                $order['delivery_location'] = null;
            }

            // Remove redundant top-level fields
            unset($order['user_full_name'], $order['phone_number'], $order['email']); // Unset the new alias and original redundant fields
            unset($order['school_address'], $order['school_latitude'], $order['school_longitude']);
        }

    } else { // 'normal' or default order type
        $stmt = $pdo->prepare("
            SELECT o.*, u.name AS user_full_name, u.phone_number, u.email,
                   s.address AS school_address, s.latitude AS school_latitude, s.longitude AS school_longitude
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN schools s ON o.school_id = s.id
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();

        if ($order) {
            // Corrected table name for normal order items (from order_items to order_details)
            $stmtItems = $pdo->prepare("SELECT * FROM order_details WHERE order_id = ?");
            $stmtItems->execute([$orderId]);
            $items = $stmtItems->fetchAll();

            // Structure user data
            $order['user'] = [
                'id' => $order['user_id'] ?? null,
                'name' => $order['user_full_name'] ?? 'N/A',
                'first_name' => explode(' ', $order['user_full_name'])[0] ?? 'N/A',
                'last_name' => isset(explode(' ', $order['user_full_name'])[1]) ? implode(' ', array_slice(explode(' ', $order['user_full_name']), 1)) : 'N/A',
                'phone_number' => $order['phone_number'] ?? 'N/A',
                'email' => $order['email'] ?? 'N/A'
            ];

            // Structure delivery location. Prioritize school location if available.
            if (!empty($order['school_address']) && !empty($order['school_latitude']) && !empty($order['school_longitude'])) {
                $order['delivery_location'] = [
                    'address' => $order['school_address'],
                    'latitude' => (float)$order['school_latitude'], // Cast to float
                    'longitude' => (float)$order['school_longitude'] // Cast to float
                ];
            } elseif (isset($order['delivery_location'])) { // Fallback to delivery_location column if school data is missing
                   $decodedLocation = json_decode($order['delivery_location'], true);
                   if (json_last_error() === JSON_ERROR_NONE) {
                       $order['delivery_location'] = $decodedLocation;
                   } else {
                       $order['delivery_location'] = null; // Set to null if decoding fails
                   }
            } else {
                $order['delivery_location'] = null;
            }

            // Remove redundant top-level fields
            unset($order['user_full_name'], $order['phone_number'], $order['email']);
            unset($order['school_address'], $order['school_latitude'], $order['school_longitude']);
        }
    }

    if (!$order) {
        http_response_code(404);
        echo json_encode(['message' => 'Order not found']);
        exit();
    }

    $order['items'] = $items;

    http_response_code(200);
    echo json_encode(['order' => $order]);
    exit();
}

// Action to update driver location
if ($action === 'update-location' && $orderId !== null && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    $latitude = $data['latitude'] ?? null;
    $longitude = $data['longitude'] ?? null;

    if ($latitude === null || $longitude === null) {
        http_response_code(400);
        echo json_encode(['message' => 'Latitude and longitude are required.']);
        exit();
    }

    $tableName = ($orderType === 'custom') ? 'custom_orders' : 'orders';

    try {
        $stmt = $pdo->prepare("UPDATE {$tableName} SET driver_latitude = ?, driver_longitude = ? WHERE id = ?");
        $stmt->execute([$latitude, $longitude, $orderId]);

        http_response_code(200);
        echo json_encode([
            'message' => 'Driver location updated successfully.',
            'newLocation' => ['latitude' => $latitude, 'longitude' => $longitude]
        ]);
        exit();
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Failed to update driver location: ' . $e->getMessage()]);
        exit();
    }
}

// New action to update order status
if ($action === 'update-status' && $orderId !== null && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    $newStatus = $data['status'] ?? null;

    if ($newStatus === null) {
        http_response_code(400);
        echo json_encode(['message' => 'New status is required.']);
        exit();
    }

    $tableName = ($orderType === 'custom') ? 'custom_orders' : 'orders';

    // Validate allowed statuses (optional but recommended for security)
    $allowedStatuses = ['pending', 'processing', 'delivering', 'delivered', 'cancelled', 'to be quoted', 'gathering', 'to be delivered', 'to deliver', 'delivered']; // Added statuses from your schema
    if (!in_array($newStatus, $allowedStatuses)) {
        http_response_code(400);
        echo json_encode(['message' => 'Invalid status provided.']);
        exit();
    }

    try {
        $stmt = $pdo->prepare("UPDATE {$tableName} SET status = ? WHERE id = ?");
        $stmt->execute([$newStatus, $orderId]);

        http_response_code(200);
        echo json_encode([
            'message' => "Order status updated to '{$newStatus}' successfully.",
            'newStatus' => $newStatus
        ]);
        exit();
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Failed to update order status: ' . $e->getMessage()]);
        exit();
    }
}


http_response_code(400);
echo json_encode(['message' => 'Invalid request. Specify orderId and orderType, or action, orderId, and orderType for update.']);
?>