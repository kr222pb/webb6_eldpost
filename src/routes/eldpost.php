<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

//  hämtar alla eldpostlistor
$app->get('/eldpostlists', function (Request $request, Response $response) {
    require '../src/config/config.php';
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    

    $stmt = $conn->prepare("SELECT * FROM eldpost_lists WHERE user_id = ? ORDER BY created_at DESC");
    $stmt->bind_param("s", $_SESSION['user']['id']);
    
    $stmt->execute();
    $result = $stmt->get_result();

    $lists = [];
    while ($row = $result->fetch_assoc()) {
        $lists[] = $row;
    }

    return $response->withHeader('Content-Type', 'application/json')
                    ->write(json_encode($lists));
});

//  ny eldpostlista
$app->post('/eldpostlists', function (Request $request, Response $response) {
    require '../src/config/config.php';
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    

    if (!isset($_SESSION['user']['id'])) {
        return $response->withStatus(401)
                        ->withHeader('Content-Type', 'application/json')
                        ->write(json_encode(["success" => false, "message" => "Inte inloggad"]));
    }

    $user_id = $_SESSION['user']['id'];

    $stmt = $conn->prepare("INSERT INTO eldpost_lists (user_id, created_at) VALUES (?, NOW())");
    $stmt->bind_param("s", $user_id);

    if ($stmt->execute()) {
        return $response->withJson(["success" => true, "eldpost_id" => $conn->insert_id]);
    } else {
        return $response->withStatus(500)->withJson([
            "success" => false,
            "message" => "Kunde inte spara",
            "error" => $stmt->error
        ]);
    }
});



$app->get('/generate-schedule/{eldpost_id}', function ($request, $response, $args) {
    require '../src/config/config.php';

    $eldpost_id = (int)$args['eldpost_id'];

    //  schema-inställningar
    $stmt = $conn->prepare("SELECT * FROM schedule_settings WHERE eldpost_id = ?");
    $stmt->bind_param("i", $eldpost_id);
    $stmt->execute();
    $scheduleResult = $stmt->get_result()->fetch_assoc();

    // Hämtar soldater
    $stmt2 = $conn->prepare("
        SELECT s.id, s.name, s.sovplats, r.role_name
        FROM soldiers s
        JOIN roles r ON s.role_id = r.id
        WHERE s.eldpost_id = ?
    ");
    $stmt2->bind_param("i", $eldpost_id);
    $stmt2->execute();
    $soldiersResult = $stmt2->get_result();

    $soldiers = [];
    while ($row = $soldiersResult->fetch_assoc()) {
        $soldiers[] = $row;
    }

    if (!$scheduleResult || count($soldiers) === 0) {
        return $response->withJson(["success" => false, "message" => "Ingen data hittades"]);
    }

    $schema = generateOptimalSchedule($scheduleResult, $soldiers);

    return $response->withJson(["success" => true, "schema" => $schema]);
});
