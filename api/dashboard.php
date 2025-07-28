<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); 
header("Access-Control-Allow-Methods: GET"); 
header("Access-Control-Allow-Headers: Content-Type"); 

$dbHost = "localhost";
$dbUser = "root";
$dbPass = "";
$dbName = "kocenpto"; 

$conn = new mysqli($dbHost, $dbUser, $dbPass, $dbName);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection failed: " . $conn->connect_error]);
    exit();
}

$year = isset($_GET['year']) ? (int)$_GET['year'] : date('Y');

$startDate = date('Y-m-d H:i:s', mktime(0, 0, 0, 1, 1, $year));
$endDate = date('Y-m-d H:i:s', mktime(23, 59, 59, 12, 31, $year));

$pendingOrders = 0;
$completedOrders = 0;
$orderRevenue = 0.0;
$customPending = 0;
$customCompleted = 0;
$customRevenue = 0.0;
$totalRevenue = 0.0;

$stmt = $conn->prepare("SELECT COUNT(*) AS count FROM orders WHERE status = 'new' AND created_at BETWEEN ? AND ?");
if ($stmt) {
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $pendingOrders = $row['count'];
    $stmt->close();
} else {
    error_log("Failed to prepare pendingOrders statement: " . $conn->error);
}

$stmt = $conn->prepare("SELECT COUNT(*) AS count FROM orders WHERE status = 'delivered' AND created_at BETWEEN ? AND ?");
if ($stmt) {
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $completedOrders = $row['count'];
    $stmt->close();
} else {
    error_log("Failed to prepare completedOrders statement: " . $conn->error);
}


$stmt = $conn->prepare("
    SELECT SUM(od.price * od.quantity) AS revenue
    FROM order_details od
    JOIN orders o ON od.order_id = o.id
    WHERE o.status = 'delivered'
    AND o.created_at BETWEEN ? AND ?
");
if ($stmt) {
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $orderRevenue = (float)($row['revenue'] ?? 0.0); 
    $stmt->close();
} else {
    error_log("Failed to prepare orderRevenue statement: " . $conn->error);
}

$stmt = $conn->prepare("SELECT COUNT(*) AS count FROM custom_orders WHERE status IN ('to_be_quoted', 'quoted', 'approved', 'gathering') AND created_at BETWEEN ? AND ?");
if ($stmt) {
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $customPending = $row['count'];
    $stmt->close();
} else {
    error_log("Failed to prepare customPending statement: " . $conn->error);
}

$stmt = $conn->prepare("SELECT COUNT(*) AS count FROM custom_orders WHERE status = 'delivered' AND created_at BETWEEN ? AND ?");
if ($stmt) {
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $customCompleted = $row['count'];
    $stmt->close();
} else {
    error_log("Failed to prepare customCompleted statement: " . $conn->error);
}


$stmt = $conn->prepare("
    SELECT SUM(coi.total_price) AS revenue
    FROM custom_order_items coi
    JOIN custom_orders co ON coi.custom_order_id = co.id
    WHERE co.status = 'delivered'
    AND co.created_at BETWEEN ? AND ?
");
if ($stmt) {
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $customRevenue = (float)($row['revenue'] ?? 0.0); 
    $stmt->close();
} else {
    error_log("Failed to prepare customRevenue statement: " . $conn->error);
}
$totalRevenue = $orderRevenue + $customRevenue;

$conn->close();

echo json_encode([
    'pendingOrders' => $pendingOrders,
    'completedOrders' => $completedOrders,
    'customPending' => $customPending,
    'customCompleted' => $customCompleted,
    'totalRevenue' => $totalRevenue
]);

?>