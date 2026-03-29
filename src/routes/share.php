<?php

use \Slim\Http\Request as Request;
use \Slim\Http\Response as Response;


$app->post('/share/create', function (Request $req, Response $res) {
    global $conn;

    try {
        if (!isset($conn)) {
            throw new Exception('$conn finns inte i config.php');
        }

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
// Måste vara inloggad för att kunna skapa en delningslänk
        if (!isset($_SESSION['user']['id'])) {
            return $res->withJson([
                'success' => false,
                'error' => 'Inte inloggad'
            ], 401);
        }

        $raw = $req->getBody()->getContents();
        $data = json_decode($raw, true);

        $eldpost_id = (int)($data['eldpost_id'] ?? 0);
        $user_id = $_SESSION['user']['id'];

        if (!$eldpost_id) {
            return $res->withJson([
                'success' => false,
                'error' => 'eldpost_id saknas'
            ], 400);
        }
// Kollar att användaren äger listan innan den delas
        if (!userOwnsEldpost($conn, $eldpost_id, $user_id)) {
            return $res->withJson([
                'success' => false,
                'error' => 'Du har inte rätt att dela denna lista'
            ], 403);
        }
 // Skapar en unik token för delningslänken
        $token = bin2hex(random_bytes(16));

        $stmt = $conn->prepare("INSERT INTO share_links (token, eldpost_id) VALUES (?, ?)");
        $stmt->bind_param("si", $token, $eldpost_id);
        $stmt->execute();

        return $res->withJson([
            'success' => true,
            'link' => 'https://melab.lnu.se/~kr222pb/webb6_eldpost/public/share/' . $token
        ]);

    } catch (Throwable $e) {
        return $res->withJson([
            'success' => false,
            'error' => $e->getMessage()
        ], 500);
    }
});

$app->get('/share/{token}', function (Request $req, Response $res, $args) {
    $token = htmlspecialchars($args['token']);

    $html = '
    <!DOCTYPE html>
    <html lang="sv">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Delat schema</title>
        <link rel="stylesheet" href="/~kr222pb/webb6_eldpost/public/css/main.css">
    </head>
    <body>
        <div class="step active" id="shared-schema">
            <h2>Delat Eldpost-schema</h2>
            <div id="schemaTables"></div>
        </div>

         <script>
            window.APP_BASE = "/~kr222pb/webb6_eldpost/public";
            window.shareToken = "' . $token . '";
        </script>
        <script src="/~kr222pb/webb6_eldpost/public/js/app.min.js"></script>
    </body>
    </html>
    ';

    return $res->write($html)->withHeader('Content-Type', 'text/html');
});

$app->get('/share-data/{token}', function ($request, $response, $args) {
    require '../src/config/config.php';

    $token = $args['token'];

    $stmt = $conn->prepare("SELECT eldpost_id FROM share_links WHERE token = ?");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $result = $stmt->get_result();
    $share = $result->fetch_assoc();

    if (!$share) {
        return $response->withJson([
            "success" => false,
            "message" => "Ogiltig länk"
        ], 404);
    }

    $eldpost_id = (int)$share['eldpost_id'];

    $stmt = $conn->prepare("
        SELECT type, time_start, time_end, soldier_names
        FROM schedule_generated
        WHERE eldpost_id = ?
        ORDER BY time_start
    ");
    $stmt->bind_param("i", $eldpost_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $entries = [];
    while ($row = $result->fetch_assoc()) {
        $entries[] = $row;
    }

    $stmt2 = $conn->prepare("
        SELECT name, sovplats
        FROM soldiers
        WHERE eldpost_id = ?
        ORDER BY sovplats
    ");
    $stmt2->bind_param("i", $eldpost_id);
    $stmt2->execute();
    $res2 = $stmt2->get_result();

    $soldiers = [];
    while ($row = $res2->fetch_assoc()) {
        $row['sovplats'] = (int)$row['sovplats'];
        $soldiers[] = $row;
    }

    return $response->withJson([
        "success" => true,
        "eldpost_id" => $eldpost_id,
        "entries" => $entries,
        "soldiers" => $soldiers
    ]);
});