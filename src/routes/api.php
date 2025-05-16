<?php

use \Slim\Http\Request as Request;
use \Slim\Http\Response as Response;

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once '../src/config/config.php'; 
require_once '../vendor/autoload.php';

$client = new Google\Client();
$client->setAuthConfig(__DIR__ . '/../../client_credentials.json'); 
$client->setRedirectUri('http://localhost:8888/auth');

$client->setScopes(['openid', 'email', 'profile']);


$app->get('/login', function (Request $req, Response $res, $args) {
    global $client;

    // inloggnings-URL
    $authUrl = $client->createAuthUrl();
    error_log("Login URL: " . $authUrl); 

    return $res->withRedirect($authUrl, 302);
});

$app->get('/auth', function (Request $req, Response $res, $args) {
    global $client;


    $params = $req->getQueryParams();
    error_log(" Google Auth callback - Query Params: " . json_encode($params));

    if (!isset($params['code'])) {
        error_log(" Ingen 'code' mottagen från Google");
        return $res->withJson(["error" => "Ingen kod mottagen"], 400);
    }


    $token = $client->fetchAccessTokenWithAuthCode($_GET['code']);


    if (isset($token['error'])) {
        error_log(" Token-fel: " . json_encode($token));
        return $res->withJson(["error" => "Token-fel", "details" => $token], 400);
    }


    $_SESSION['google_token'] = $token;
    $client->setAccessToken($token);

    $token_data = $client->verifyIdToken();

    if (!$token_data) {
        error_log(" Token-verifiering misslyckades");
        return $res->withJson(["error" => "Token-verifiering misslyckades"], 400);
    }

    $_SESSION['user'] = upsert_user($token_data);

    error_log(" Inloggning lyckades: " . json_encode($_SESSION['user']));

    //  Omdirigerar användaren till startsidan
    return $res->withRedirect('/');
});



$app->get('/user', function (Request $req, Response $res, $args) {

    if (!isset($_SESSION['user'])) {
        return $res->withJson(["logged_in" => false]);
    }

    return $res->withJson(["logged_in" => true, "user" => $_SESSION['user']]);
});
$app->get('/logout', function (Request $req, Response $res, $args) {
    session_destroy(); 
    return $res->withRedirect('/');
});

