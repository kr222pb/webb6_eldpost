<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL & ~E_DEPRECATED);


$host = "localhost";  
$user = "root";       
$password = "root";   
$database = "eldpost"; 
$port = 8888;


$conn = new mysqli($host, $user, $password, $database, $port);


if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
if (!function_exists('upsert_user')) {
    function upsert_user($idToken) {
        global $conn; 

        $query = "INSERT INTO users (google_id, display_name, profile_url) 
                  VALUES (?, ?, ?) 
                  ON DUPLICATE KEY UPDATE 
                  display_name = VALUES(display_name), 
                  profile_url = VALUES(profile_url)";

        $stmt = $conn->prepare($query);
        if (!$stmt) {
            die(" SQL-fel: " . $conn->error);
        }

        $stmt->bind_param("sss", 
            $idToken['sub'], 
            $idToken['name'], 
            $idToken['picture']
        );
        $stmt->execute();


        $stmt = $conn->prepare("SELECT * FROM users WHERE google_id = ?");
        $stmt->bind_param("s", $idToken['sub']);
        $stmt->execute();
        $result = $stmt->get_result();
        
        return $result->fetch_assoc();
    }
}

