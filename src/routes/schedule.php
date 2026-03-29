<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
function userOwnsEldpost($conn, $eldpost_id, $user_id) {
    $stmt = $conn->prepare("SELECT id FROM eldpost_lists WHERE id = ? AND user_id = ?");
    $stmt->bind_param("is", $eldpost_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    return $result->fetch_assoc() !== null;
}
$app->get('/get-schedule/{eldpost_id}', function ($request, $response, $args) {
    require '../src/config/config.php';

    if (session_status() === PHP_SESSION_NONE) session_start();
    if (!isset($_SESSION['user']['id'])) {
        return $response->withJson(["success" => false, "message" => "Inte inloggad"], 401);
    }

    $eldpost_id = (int)$args['eldpost_id'];
    $user_id = $_SESSION['user']['id'];

    if (!userOwnsEldpost($conn, $eldpost_id, $user_id)) {
        return $response->withJson(["success" => false, "message" => "Obehörig"], 403);
    }

    $sql = "SELECT * FROM schedule_settings WHERE eldpost_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $eldpost_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $schedule = $result->fetch_assoc();

    $soldiersQuery = "SELECT s.id, s.name, r.role_name, s.sovplats 
                      FROM soldiers s
                      JOIN roles r ON s.role_id = r.id
                      WHERE s.eldpost_id = ?";
    $soldiersStmt = $conn->prepare($soldiersQuery);
    $soldiersStmt->bind_param("i", $eldpost_id);
    $soldiersStmt->execute();
    $soldiersResult = $soldiersStmt->get_result();

    $soldiers = [];
    while ($row = $soldiersResult->fetch_assoc()) {
        $soldiers[] = $row;
    }

    return $response->withJson([
        "success" => true,
        "schedule" => $schedule,
        "soldiers" => $soldiers
    ]);
});




//  Sparar tidsschema kopplat till eldpost_id
$app->post('/save-schedule', function (Request $request, Response $response, $args) {
    require '../src/config/config.php';

    if (session_status() === PHP_SESSION_NONE) session_start();
    if (!isset($_SESSION['user']['id'])) {
        return $response->withJson(["success" => false, "message" => "Inte inloggad"], 401);
    }

    $data = json_decode($request->getBody(), true);

    if (!isset($data['eldpost_id'], $data['eldpost_start'], $data['eldpost_end'], $data['vaktpost_duration'], $data['patrull_duration'])) {
        return $response->withJson(["success" => false, "message" => "Alla fält krävs"], 400);
    }

    $eldpost_id = (int)$data['eldpost_id'];
    $user_id = $_SESSION['user']['id'];

    if (!userOwnsEldpost($conn, $eldpost_id, $user_id)) {
        return $response->withJson(["success" => false, "message" => "Du har inte rätt att ändra denna lista"], 403);
    }

    $eldpost_start = $data['eldpost_start'];
    $eldpost_end = $data['eldpost_end'];
    $vaktpost_duration = $data['vaktpost_duration'];
    $patrull_duration = $data['patrull_duration'];

    $stmt = $conn->prepare("INSERT INTO schedule_settings (eldpost_id, eldpost_start, eldpost_end, vaktpost_duration, patrull_duration) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("issii", $eldpost_id, $eldpost_start, $eldpost_end, $vaktpost_duration, $patrull_duration);

    if ($stmt->execute()) {
        return $response->withJson(["success" => true, "message" => "Tidsinställningar sparade!"], 200);
    } else {
        return $response->withJson(["success" => false, "message" => "Fel vid SQL-exekvering: " . $stmt->error], 500);
    }
});
$app->post('/save-generated-schedule', function ($request, $response) {
    require '../src/config/config.php';

    if (session_status() === PHP_SESSION_NONE) session_start();
    if (!isset($_SESSION['user']['id'])) {
        return $response->withJson(["success" => false, "message" => "Inte inloggad"], 401);
    }

    $data = json_decode($request->getBody(), true);
    $eldpost_id = (int)($data['eldpost_id'] ?? 0);
    $entries = $data['entries'] ?? [];
    $user_id = $_SESSION['user']['id'];

    if (!$eldpost_id || empty($entries)) {
        return $response->withJson(["success" => false, "message" => "Ogiltig data (eldpost_id eller entries saknas)"], 400);
    }

    if (!userOwnsEldpost($conn, $eldpost_id, $user_id)) {
        return $response->withJson(["success" => false, "message" => "Du har inte rätt att ändra denna lista"], 403);
    }

    $stmt = $conn->prepare("
        INSERT INTO schedule_generated (eldpost_id, type, time_start, time_end, soldier_names)
        VALUES (?, ?, ?, ?, ?)
    ");

    if (!$stmt) {
        return $response->withJson(["success" => false, "message" => "Kunde inte förbereda statement"], 500);
    }

    foreach ($entries as $entry) {
        $type = $entry['type'] ?? null;
        $soldiers = $entry['soldier'] ?? null;
        $timeStr = $entry['time'] ?? null;

        if (!$type || !$soldiers || !$timeStr) {
            continue;
        }

        if (preg_match('/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/', $entry['time'], $matches)) {
            $start = $matches[1];
            $end = $matches[2];

            $stmt->bind_param("issss", $eldpost_id, $type, $start, $end, $soldiers);
            $stmt->execute();
        }
    }

    return $response->withJson(["success" => true, "message" => "Schema sparat"]);
});
$app->get('/get-saved-schedule/{eldpost_id}', function ($request, $response, $args) {
    require '../src/config/config.php';

    if (session_status() === PHP_SESSION_NONE) session_start();
    if (!isset($_SESSION['user']['id'])) {
        return $response->withJson(["success" => false, "message" => "Inte inloggad"], 401);
    }

    $eldpost_id = (int)$args['eldpost_id'];
    $user_id = $_SESSION['user']['id'];

    if (!userOwnsEldpost($conn, $eldpost_id, $user_id)) {
        return $response->withJson(["success" => false, "message" => "Obehörig"], 403);
    }

    $stmt = $conn->prepare("SELECT type, time_start, time_end, soldier_names FROM schedule_generated WHERE eldpost_id = ? ORDER BY time_start");
    $stmt->bind_param("i", $eldpost_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $entries = [];
    while ($row = $result->fetch_assoc()) {
        $entries[] = $row;
    }

    $stmt2 = $conn->prepare("SELECT name, sovplats FROM soldiers WHERE eldpost_id = ?");
    $stmt2->bind_param("i", $eldpost_id);
    $stmt2->execute();
    $res2 = $stmt2->get_result();

    $beds = [];
    while ($row = $res2->fetch_assoc()) {
        $beds[$row['name']] = $row['sovplats'];
    }

    return $response->withJson([
        "success" => true,
        "entries" => $entries,
        "beds" => $beds
    ]);
});


$app->get('/my-schedules', function ($request, $response) {
    require '../src/config/config.php';

    if (session_status() === PHP_SESSION_NONE) session_start();
    if (!isset($_SESSION['user']['id'])) {
        return $response->withJson(["success" => false, "message" => "Inte inloggad"], 401);
    }

    $user_id = $_SESSION['user']['id'];

    $query = "
        SELECT sg.eldpost_id,
               sg.time_start,
               sg.time_end,
               sg.type,
               sg.soldier_names,
               el.created_at
        FROM schedule_generated sg
        JOIN eldpost_lists el ON sg.eldpost_id = el.id
        WHERE el.user_id = ?
        ORDER BY el.created_at DESC, sg.time_start ASC
    ";

    $stmt = $conn->prepare($query);
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $entries = [];
    while ($row = $result->fetch_assoc()) {
        $entries[] = $row;
    }

    return $response->withJson(["success" => true, "entries" => $entries]);
});

