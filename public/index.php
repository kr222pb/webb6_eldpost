<?php
error_reporting(E_ALL & ~E_DEPRECATED);

require '../vendor/autoload.php';
require '../src/config/config.php'; // Databasanslutning

$app = new \Slim\App([
    'settings' => [
        'displayErrorDetails' => true,  
    ]
]);

$app->get('/', function ($request, $response, $args) {
    $filePath = realpath(__DIR__ . '/../public/admin.html'); 

    if (file_exists($filePath)) {
        return $response->write(file_get_contents($filePath))->withHeader('Content-Type', 'text/html');
    } else {
        return $response->withStatus(404)->write("404 - Admin Dashboard Not Found");
    }
});

//  routes
require '../src/routes/api.php';
require '../src/routes/soldiers.php';
require '../src/routes/schedule.php';
require '../src/routes/eldpost.php';
require '../src/routes/schedule_generate.php';




$app->get('/public/{file:.+}', function ($request, $response, $args) {
    $file = $args['file'];
    $filePath = realpath(__DIR__ . '/../public/' . $file);

    if ($filePath && file_exists($filePath)) {
        $mimeType = mime_content_type($filePath);
        return $response->withHeader('Content-Type', $mimeType)->write(file_get_contents($filePath));
    }

    return $response->withStatus(404)->write("File not found");
});

$app->any('/{route:.+}', function ($request, $response, $args) {
    return $response->withStatus(404)->write("404 - Page Not Found");
});



$app->run();


