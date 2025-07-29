<?php
// KonceptoAdmin/api/chat.php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Added POST for sending messages
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
$dbPass = "teamvanguard";
$dbName = "kocenpto";

// --- IMPORTANT: Define your Laravel storage path ---
// This path must point to the 'storage/app/public' directory
// inside your Laravel project.
// Based on your paths:
// Laravel Project Root: C:\Users\Renz\Herd\kocenpto
// Actual public storage files will be in: C:\Users\Renz\Herd\kocenpto\storage\app\public
$STORAGE_UPLOAD_DIRECTORY = realpath('C:/Users/Renz/Herd/kocenpto/storage/app/public');

// Ensure the directory exists and is writable
if (!is_dir($STORAGE_UPLOAD_DIRECTORY)) {
    // Attempt to create the directory if it doesn't exist
    if (!mkdir($STORAGE_UPLOAD_DIRECTORY, 0777, true)) {
        error_log("Failed to create storage directory: " . $STORAGE_UPLOAD_DIRECTORY, 0);
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Server error: Storage directory could not be created."]);
        exit();
    }
}
// For debugging, check if the directory is writable
if (!is_writable($STORAGE_UPLOAD_DIRECTORY)) {
    error_log("Storage directory not writable: " . $STORAGE_UPLOAD_DIRECTORY, 0);
    // You might want to exit here or just log a warning based on your preference
}


function getDbConnection() {
    static $conn = null;
    if ($conn === null) {
        $conn = new mysqli($GLOBALS['dbHost'], $GLOBALS['dbUser'], $GLOBALS['dbPass'], $GLOBALS['dbName']);
        if ($conn->connect_error) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Database connection failed: " . $conn->connect_error]);
            error_log("Database connection failed: " . $conn->connect_error, 0);
            exit();
        }
    }
    return $conn;
}

function getAuthenticatedAdminId() {
    if (isset($_SERVER['HTTP_X_ADMIN_ID'])) {
        $adminId = (int)$_SERVER['HTTP_X_ADMIN_ID'];
        $conn = getDbConnection();
        
        if ($adminId <= 0) {
            http_response_code(401);
            echo json_encode(["error" => "Unauthenticated: Invalid X-Admin-ID (ID must be positive)."]);
            exit();
        }

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

$action = $_REQUEST['action'] ?? ''; // Use $_REQUEST to get action from GET or POST
$conn = getDbConnection();
$adminId = getAuthenticatedAdminId(); 

switch ($action) {
    case 'users':
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            http_response_code(405);
            echo json_encode(["error" => "Method Not Allowed"]);
            exit();
        }

        $stmt = $conn->prepare("
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.school_id,
                s.school_name,
                s.image AS school_image,
                (SELECT message FROM messages WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) AS last_message,
                (SELECT created_at FROM messages WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) AS last_message_time,
                (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = FALSE) AS unread_count
            FROM
                users u
            LEFT JOIN
                schools s ON u.school_id = s.id
            WHERE
                u.role = 'school_admin'
            ORDER BY
                u.first_name ASC, u.last_name ASC
        ");

        if ($stmt) {
            $stmt->bind_param("iiiii", $adminId, $adminId, $adminId, $adminId, $adminId); 
            $stmt->execute();
            $result = $stmt->get_result();
            $usersData = [];
            while ($user = $result->fetch_assoc()) {
                $usersData[] = [
                    'id' => $user['id'], 
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'school' => [
                        'id' => $user['school_id'], 
                        'school_name' => $user['school_name'],
                        'image' => $user['school_image'], 
                    ],
                    'last_message' => $user['last_message'],
                    'last_message_time' => $user['last_message_time'],
                    'unread_count' => (int)$user['unread_count'],
                ];
            }
            $stmt->close();
            echo json_encode($usersData);
        } else {
            http_response_code(500);
            $error_message = "Failed to prepare users statement: " . $conn->error;
            error_log($error_message, 0); 
            echo json_encode(["success" => false, "message" => $error_message]);
            exit();
        }
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
        
        $conn->begin_transaction();

        try {
            // Mark messages as read
            $stmtUpdate = $conn->prepare("UPDATE messages SET is_read = TRUE, updated_at = NOW() WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE");
            if ($stmtUpdate) {
                $stmtUpdate->bind_param("ii", $userId, $adminId);
                $stmtUpdate->execute();
                $stmtUpdate->close();
            } else {
                throw new Exception("Failed to prepare update messages statement: " . $conn->error);
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
                throw new Exception("Failed to prepare fetch messages statement: " . $conn->error);
            }

            $conn->commit();
            echo json_encode($messages);

        } catch (Exception $e) {
            $conn->rollback();
            http_response_code(500);
            $error_message = "Error fetching/marking messages: " . $e->getMessage();
            error_log($error_message, 0);
            echo json_encode(["success" => false, "message" => $error_message]);
            exit();
        }
        break;

    case 'send_message':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(["error" => "Method Not Allowed"]);
            exit();
        }

        $receiverId = isset($_POST['receiver_id']) ? (int)$_POST['receiver_id'] : 0;
        $messageText = $_POST['message'] ?? '';
        $senderId = $adminId; // Admin is always the sender from this panel

        if ($receiverId <= 0) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Bad Request: Missing or invalid receiver_id."]);
            exit();
        }
        if (empty($messageText) && !isset($_FILES['attachment'])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Message text or attachment is required."]);
            exit();
        }

        $attachmentPath = null;
        $originalFileName = null;

        // Handle file upload if present
        if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['attachment'];
            $uploadDir = $STORAGE_UPLOAD_DIRECTORY; 

            // Check if the directory is writable before attempting to move the file
            if (!is_writable($uploadDir)) {
                http_response_code(500);
                echo json_encode(["success" => false, "message" => "Server error: Attachment upload directory is not writable."]);
                error_log("Attachment upload directory not writable: " . $uploadDir, 0);
                exit();
            }

            $originalFileName = basename($file['name']);
            $fileExtension = pathinfo($originalFileName, PATHINFO_EXTENSION);
            $newFileName = uniqid('chat_') . '.' . $fileExtension;
            $destination = $uploadDir . '/' . $newFileName;

            if (move_uploaded_file($file['tmp_name'], $destination)) {
                $attachmentPath = $newFileName; // Store only the filename in DB relative to storage base
            } else {
                http_response_code(500);
                echo json_encode(["success" => false, "message" => "Failed to upload attachment."]);
                error_log("Failed to move uploaded file: " . $file['tmp_name'] . " to " . $destination . " Error: " . $file['error'], 0);
                exit();
            }
        } elseif (isset($_FILES['attachment']) && $_FILES['attachment']['error'] !== UPLOAD_ERR_NO_FILE) {
             http_response_code(500);
             echo json_encode(["success" => false, "message" => "Attachment upload error: " . $_FILES['attachment']['error'] . " (Code: " . $_FILES['attachment']['error'] . ")"]);
             error_log("Attachment upload error: " . $_FILES['attachment']['error'], 0);
             exit();
        }

        try {
            $stmt = $conn->prepare("INSERT INTO messages (sender_id, receiver_id, message, attachment, original_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())");
            if (!$stmt) {
                throw new Exception("Failed to prepare send message statement: " . $conn->error);
            }
            $stmt->bind_param("iisss", $senderId, $receiverId, $messageText, $attachmentPath, $originalFileName);
            
            if ($stmt->execute()) {
                http_response_code(200);
                echo json_encode(["success" => true, "message_id" => $conn->insert_id]);
            } else {
                throw new Exception("Failed to execute send message statement: " . $stmt->error);
            }
            $stmt->close();
        } catch (Exception $e) {
            http_response_code(500);
            $error_message = "Error sending message: " . $e->getMessage();
            error_log($error_message, 0);
            echo json_encode(["success" => false, "message" => $error_message]);
            exit();
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(["error" => "Invalid or missing action parameter."]);
        break;
}
?>