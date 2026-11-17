<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
require_once 'db.php';
require_once 'tiktok_client.php';

header('Content-Type: text/plain');

$db = getDBConnection();
$config = $db->query("SELECT * FROM `tiktok_config` LIMIT 1")->fetch();

if (!$config) {
    echo "No config found in database!\n";
    exit;
}

echo "Config Shop ID: " . $config['shop_id'] . "\n";
echo "Config Access Token: " . $config['access_token'] . "\n";

class TestClient extends TikTokShopClient {
    public function testGetShops($accessToken) {
        $path = "/authorization/202309/shops";
        $timestamp = time();
        
        $queryParams = [
            'app_key' => TIKTOK_APP_KEY,
            'timestamp' => $timestamp
        ];
        
        $sign = $this->generateSignWrapped($path, $queryParams);
        $url = "https://open-api.tiktokglobalshop.com" . $path . "?" . http_build_query(array_merge($queryParams, ['sign' => $sign]));
        $res = $this->callAPI($url, $accessToken);
        $resData = json_decode($res, true);
        
        $cipher = $resData['data']['shops'][0]['cipher'] ?? null;
        echo "Retrieved Cipher: " . $cipher . "\n";
        return $cipher;
    }
    
    public function testSearchOrders($accessToken, $cipher) {
        if (!$cipher) {
            echo "Cannot search orders without cipher!\n";
            return;
        }
        
        $path = "/order/202309/orders/search";
        $timestamp = time();
        $startTime = time() - (86400 * 30);
        $endTime = time();
        
        // TEST D: page_size as Query Parameter, body contains only time filters in snake_case
        $queryParamsD = [
            'app_key' => TIKTOK_APP_KEY,
            'timestamp' => $timestamp,
            'shop_cipher' => $cipher,
            'page_size' => 20
        ];
        $bodyD = [
            "create_time_ge" => $startTime,
            "create_time_lt" => $endTime
        ];
        $bodyStrD = json_encode($bodyD);
        $signD = $this->generateSignWrapped($path, $queryParamsD, $bodyStrD);
        $urlD = "https://open-api.tiktokglobalshop.com" . $path . "?" . http_build_query(array_merge($queryParamsD, ['sign' => $signD]));
        echo "\n--- TEST D: page_size in Query Params, time filters in body ---\n";
        echo "Query: " . json_encode($queryParamsD) . "\n";
        echo "Body: " . $bodyStrD . "\n";
        $resD = $this->callAPI($urlD, $accessToken, $bodyStrD);
        echo "Response: " . $resD . "\n";
        
        // TEST E: PageSize (casing exactly as in the error message) in JSON body
        $queryParamsE = [
            'app_key' => TIKTOK_APP_KEY,
            'timestamp' => $timestamp,
            'shop_cipher' => $cipher
        ];
        $bodyE = [
            "PageSize" => 20,
            "CreateTimeGe" => $startTime,
            "CreateTimeLt" => $endTime
        ];
        $bodyStrE = json_encode($bodyE);
        $signE = $this->generateSignWrapped($path, $queryParamsE, $bodyStrE);
        $urlE = "https://open-api.tiktokglobalshop.com" . $path . "?" . http_build_query(array_merge($queryParamsE, ['sign' => $signE]));
        echo "\n--- TEST E: PageSize (exactly capitalized) in body ---\n";
        echo "Body: " . $bodyStrE . "\n";
        $resE = $this->callAPI($urlE, $accessToken, $bodyStrE);
        echo "Response: " . $resE . "\n";
        
        // TEST F: pageSize (camelCase) as Query Parameter
        $queryParamsF = [
            'app_key' => TIKTOK_APP_KEY,
            'timestamp' => $timestamp,
            'shop_cipher' => $cipher,
            'pageSize' => 20
        ];
        $bodyF = [
            "create_time_ge" => $startTime,
            "create_time_lt" => $endTime
        ];
        $bodyStrF = json_encode($bodyF);
        $signF = $this->generateSignWrapped($path, $queryParamsF, $bodyStrF);
        $urlF = "https://open-api.tiktokglobalshop.com" . $path . "?" . http_build_query(array_merge($queryParamsF, ['sign' => $signF]));
        echo "\n--- TEST F: pageSize in Query Params, time filters in body ---\n";
        echo "Query: " . json_encode($queryParamsF) . "\n";
        echo "Body: " . $bodyStrF . "\n";
        $resF = $this->callAPI($urlF, $accessToken, $bodyStrF);
        echo "Response: " . $resF . "\n";
    }
    
    private function generateSignWrapped($path, $params, $body = '') {
        ksort($params);
        $queryString = '';
        foreach ($params as $key => $value) {
            $queryString .= $key . $value;
        }
        $baseString = TIKTOK_APP_SECRET . $path . $queryString . $body . TIKTOK_APP_SECRET;
        return hash_hmac('sha256', $baseString, TIKTOK_APP_SECRET);
    }
    
    private function callAPI($url, $accessToken, $postBody = null) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $headers = [
            'Content-Type: application/json',
            'x-tts-access-token: ' . $accessToken
        ];
        if ($postBody !== null) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postBody);
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $res = curl_exec($ch);
        curl_close($ch);
        return $res;
    }
}

$client = new TestClient();
$cipher = $client->testGetShops($config['access_token']);
$client->testSearchOrders($config['access_token'], $cipher);

