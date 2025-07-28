<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Admin-ID");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$dbHost = "localhost";
$dbUser = "root";
$dbPass = "";
$dbName = "kocenpto";

function getDbConnection() {
    static $conn = null;
    if ($conn === null) {
        $conn = new mysqli($GLOBALS['dbHost'], $GLOBALS['dbUser'], $GLOBALS['dbPass'], $GLOBALS['dbName']);
        if ($conn->connect_error) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Database connection failed: " . $conn->connect_error]);
            exit();
        }
    }
    return $conn;
}

function getAuthenticatedAdminId() {
    if (isset($_SERVER['HTTP_X_ADMIN_ID'])) {
        $adminId = (int)$_SERVER['HTTP_X_ADMIN_ID'];
        $conn = getDbConnection();
        $stmt = $conn->prepare("SELECT id FROM users WHERE id = ? AND role = 'admin'");
        if ($stmt) {
            $stmt->bind_param("i", $adminId);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows === 1) {
                $stmt->close();
                return $adminId;
            }
            $stmt->close();
        }
    }
    http_response_code(401);
    echo json_encode(["error" => "Unauthenticated: X-Admin-ID header missing or invalid."]);
    exit();
}

$action = $_GET['action'] ?? '';
$conn = getDbConnection();
$adminId = getAuthenticatedAdminId();

switch ($action) {
    case 'users':
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            http_response_code(405);
            echo json_encode(["error" => "Method Not Allowed"]);
            exit();
        }
        $usersData = [];
        $stmt = $conn->prepare("
            SELECT u.id, u.first_name, u.last_name, u.school_id, s.school_name, s.image AS school_image
            FROM users u
            LEFT JOIN schools s ON u.school_id = s.id
            WHERE u.role = 'school_admin'
            ORDER BY u.first_name ASC, u.last_name ASC
        ");
        if ($stmt) {
            $stmt->execute();
            $result = $stmt->get_result();
            while ($user = $result->fetch_assoc()) {
                $userId = $user['id'];
                // Get last message between admin and this school_admin
                $stmtLast = $conn->prepare("
                    SELECT message, created_at
                    FROM messages
                    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                    ORDER BY created_at DESC
                    LIMIT 1
                ");
                $lastMessage = null;
                $lastMessageTime = null;
                if ($stmtLast) {
                    $stmtLast->bind_param("iiii", $userId, $adminId, $adminId, $userId);
                    $stmtLast->execute();
                    $resLast = $stmtLast->get_result();
                    $rowLast = $resLast->fetch_assoc();
                    $lastMessage = $rowLast['message'] ?? null;
                    $lastMessageTime = $rowLast['created_at'] ?? null;
                    $stmtLast->close();
                }
                // Get unread count (messages sent by school_admin to admin and not read)
                $stmtUnread = $conn->prepare("
                    SELECT COUNT(*) AS unread_count
                    FROM messages
                    WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE
                ");
                $unreadCount = 0;
                if ($stmtUnread) {
                    $stmtUnread->bind_param("ii", $userId, $adminId);
                    $stmtUnread->execute();
                    $resUnread = $stmtUnread->get_result();
                    $rowUnread = $resUnread->fetch_assoc();
                    $unreadCount = $rowUnread['unread_count'];
                    $stmtUnread->close();
                }
                $usersData[] = [
                    'id' => $user['id'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'school' => [
                        'id' => $user['school_id'],
                        'school_name' => $user['school_name'],
                        'image' => $user['school_image'],
                    ],
                    'last_message' => $lastMessage,
                    'last_message_time' => $lastMessageTime,
                    'unread_count' => $unreadCount,
                ];
            }
            $stmt->close();
        } else {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Failed to prepare users statement: " . $conn->error]);
            exit();
        }
        echo json_encode($usersData);
        break;

    case 'messages':
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            http_response_code(405);
            echo json_encode(["error" => "Method Not Allowed"]);
            exit();
        }
        $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
        if ($userId <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "Bad Request: Missing or invalid user_id."]);
            exit();
        }
        // Mark messages as read
        $stmtUpdate = $conn->prepare("UPDATE messages SET is_read = TRUE, updated_at = NOW() WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE");
        if ($stmtUpdate) {
            $stmtUpdate->bind_param("ii", $userId, $adminId);
            $stmtUpdate->execute();
            $stmtUpdate->close();
        }
        // Fetch messages
        $messages = [];
        $stmt = $conn->prepare("
            SELECT m.id, m.sender_id, m.receiver_id, m.message, m.attachment, m.original_name, m.created_at, m.updated_at
            FROM messages m
            WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC
        ");
        if ($stmt) {
            $stmt->bind_param("iiii", $adminId, $userId, $userId, $adminId);
            $stmt->execute();
            $result = $stmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $messages[] = $row;
            }
            $stmt->close();
        } else {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Failed to prepare messages statement: " . $conn->error]);
            exit();
        }
        echo json_encode($messages);
        break;

    default:
        http_response_code(400);
        echo json_encode(["error" => "Invalid or missing action parameter."]);
        break;
}
?>