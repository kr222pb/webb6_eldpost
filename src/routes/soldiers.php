<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;


$app->get('/roles', function (Request $request, Response $response) {
    require '../src/config/config.php';

    $sql = "SELECT * FROM roles";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $result = $stmt->get_result();

    $roles = [];
    while ($row = $result->fetch_assoc()) {
        $roles[] = $row;
    }

    return $response->withHeader('Content-Type', 'application/json')
                    ->write(json_encode($roles));
});


$app->post('/soldiers', function (Request $request, Response $response) {
    require '../src/config/config.php';

    $data = json_decode($request->getBody(), true);

    if (!isset($data['eldpost_id'], $data['name'], $data['role_id'], $data['sovplats'])) {
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json')
                        ->write(json_encode(["success" => false, "message" => "Alla fält krävs (inkl. eldpost_id)!"]));
    }

    $eldpost_id = (int)$data['eldpost_id'];
    $name = $data['name'];
    $role_id = (int)$data['role_id'];
    $sovplats = (int)$data['sovplats'];


    $checkSql = "SELECT id FROM soldiers WHERE eldpost_id = ? AND sovplats = ?";
    $stmtCheck = $conn->prepare($checkSql);
    $stmtCheck->bind_param("ii", $eldpost_id, $sovplats);
    $stmtCheck->execute();
    $checkResult = $stmtCheck->get_result();

    if ($checkResult->num_rows > 0) {
        return $response->withHeader('Content-Type', 'application/json')
                        ->write(json_encode(["success" => false, "message" => "Sovplatsen är redan upptagen!"]));
    }


    $insertSql = "INSERT INTO soldiers (eldpost_id, name, role_id, sovplats) VALUES (?, ?, ?, ?)";
    $stmt = $conn->prepare($insertSql);
    $stmt->bind_param("isii", $eldpost_id, $name, $role_id, $sovplats);

    if ($stmt->execute()) {
        return $response->withHeader('Content-Type', 'application/json')
                        ->write(json_encode(["success" => true, "message" => "Soldat tillagd!"]));
    } else {
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json')
                        ->write(json_encode(["success" => false, "message" => "SQL-fel: " . $stmt->error]));
    }
});

$app->get('/soldiers/{eldpost_id}', function (Request $request, Response $response, $args) {
    require '../src/config/config.php';

    $eldpost_id = (int)$args['eldpost_id'];

   
    $check_sql = "SELECT id FROM eldpost_lists WHERE id = ?";
    $stmt = $conn->prepare($check_sql);
    $stmt->bind_param("i", $eldpost_id);
    $stmt->execute();
    $check_result = $stmt->get_result();

    if ($check_result->num_rows === 0) {
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json')
                        ->write(json_encode(["success" => false, "message" => "Eldpostlista existerar inte"]));
    }


    $sql = "SELECT soldiers.id, soldiers.name, soldiers.sovplats, roles.role_name 
            FROM soldiers 
            JOIN roles ON soldiers.role_id = roles.id 
            WHERE soldiers.eldpost_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $eldpost_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $soldiers = [];
    while ($row = $result->fetch_assoc()) {
        $soldiers[] = $row;
    }

    return $response->withHeader('Content-Type', 'application/json')
                    ->write(json_encode($soldiers));
});


$app->put('/update-soldier/{id}', function (Request $request, Response $response, $args) {
    require '../src/config/config.php';

    $soldier_id = $args['id'];
    $data = json_decode($request->getBody(), true);

    if (!isset($data['field'], $data['value'])) {
        return $response->withJson(["success" => false, "message" => "Fält och värde krävs!"], 400);
    }

    $allowedFields = ['name', 'role_id', 'sovplats'];
    if (!in_array($data['field'], $allowedFields)) {
        return $response->withJson(["success" => false, "message" => "Otillåtet fält!"], 400);
    }

    $field = $data['field'];
    $value = $data['value'];

    $sql = "UPDATE soldiers SET $field = ? WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("si", $value, $soldier_id);

    if ($stmt->execute()) {
        return $response->withJson(["success" => true, "message" => "Soldat uppdaterad!"], 200);
    } else {
        return $response->withJson(["success" => false, "message" => "Fel vid SQL-exekvering: " . $stmt->error], 500);
    }
});

