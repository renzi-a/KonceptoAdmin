<?php
// KonceptoAdmin/api/login.php

// Set headers for JSON response and CORS
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS"); // Allow OPTIONS for preflight requests
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight OPTIONS request (important for CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- IMPORTANT: Enable error reporting for debugging ---
// For development: display all errors
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
// For logging to a file (check your php.ini for error_log path, or define one)
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_error.log'); // Logs errors to a file next to login.php

// Database connection parameters
// !!! IMPORTANT: Replace with your actual database credentials !!!
$dbHost = "localhost";
$dbUser = "root";
$dbPass = "teamvanguard";
$dbName = "kocenpto";

// Establish database connection
$conn = new mysqli($dbHost, $dbUser, $dbPass, $dbName);

// Check connection
if ($conn->connect_error) {
    http_response_code(500);
    $errorMessage = "Database connection failed: " . $conn->connect_error;
    error_log($errorMessage); // Log the error
    echo json_encode(["success" => false, "message" => $errorMessage]);
    exit();
}

// Get POST data
$data = json_decode(file_get_contents("php://input"), true);

// Log received data for debugging
error_log("Received login request data: " . print_r($data, true));

$email = trim($data['email'] ?? '');
$password = trim($data['password'] ?? '');

if (!$email || !$password) {
    http_response_code(400);
    $errorMessage = "Missing email or password";
    error_log($errorMessage); // Log the error
    echo json_encode(["success" => false, "message" => $errorMessage]);
    exit();
}

try {
    // Check user with role = admin
    // Ensure table name 'users' and column names 'email', 'role', 'password', 'id', 'first_name', 'last_name', 'created_at' are correct
    $stmt = $conn->prepare("SELECT id, first_name, last_name, email, role, password, created_at FROM users WHERE email = ? AND role = 'admin'");
    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $conn->error);
    }
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();

        // Verify password
        if (password_verify($password, $user['password'])) {
            // (Optional) Generate dummy token — replace with real token logic if needed
            $token = base64_encode(bin2hex(random_bytes(32)));

            echo json_encode([
                "success" => true,
                "token" => $token,
                "user" => [
                    "id" => $user["id"],
                    "first_name" => $user["first_name"],
                    "last_name" => $user["last_name"],
                    "email" => $user["email"],
                    "role" => $user["role"],
                    "date_joined" => $user["created_at"]
                ]
            ]);
            error_log("Login successful for email: " . $email);
        } else {
            http_response_code(401);
            $errorMessage = "Incorrect password for email: " . $email;
            error_log($errorMessage); // Log the error
            echo json_encode(["success" => false, "message" => "Incorrect password"]);
        }
    } else {
        http_response_code(401);
        $errorMessage = "Unauthorized or email not found: " . $email;
        error_log($errorMessage); // Log the error
        echo json_encode(["success" => false, "message" => "Unauthorized or email not found"]);
    }

    $stmt->close();
} catch (Exception $e) {
    http_response_code(500);
    $errorMessage = "Server error during login: " . $e->getMessage();
    error_log($errorMessage); // Log the exception
    echo json_encode(["success" => false, "message" => "An internal server error occurred."]);
} finally {
    $conn->close();
}

?>