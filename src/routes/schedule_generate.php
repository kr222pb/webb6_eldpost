<?php
function generateOptimalSchedule($schedule, $soldiers) {
    // Filtrerar bort plutonchef och stf_plutonchef
    $filtered = array_filter($soldiers, function ($s) {
        return !in_array(strtolower($s['role_name']), ['plutonchef', 'stf_plutonchef']);
    });
    $filtered = array_values($filtered);

    if (count($filtered) < 3) {
        return ["success" => false, "message" => "Minst 3 soldater krävs", "schema" => []];
    }

    
    $start = strtotime("1970-01-01 " . $schedule['eldpost_start']);
    $end = strtotime("1970-01-01 " . $schedule['eldpost_end']);
    if ($end <= $start) {
        $end = strtotime("+1 day", $end);
    }
    $totalHours = ($end - $start) / 3600;

    $schema = [];
    $prevVakt = null; // Kommer gå på patrull nästa timme
    $lastUsed = [];

    for ($i = 0; $i < $totalHours; $i++) {
        $currentTime = strtotime("+$i hour", $start);
        $nextTime = strtotime("+1 hour", $currentTime);
        $timeLabel = date("H:i", $currentTime) . " - " . date("H:i", $nextTime);

        // en person för vaktpost
        $vakt = null;
        foreach ($filtered as $s) {
            $id = $s['id'];
            if (($lastUsed[$id] ?? -100) < $i) {
                $vakt = $s;
                $lastUsed[$id] = $i;
                break;
            }
        }
        if (!$vakt) continue;

        //  Väljer patrull, vakt från förra timmen + 1 annan
        $patrull = [];

        if ($prevVakt) {
            $patrull[] = $prevVakt;
            $lastUsed[$prevVakt['id']] = $i;
        }

        foreach ($filtered as $s) {
            $id = $s['id'];
            if (count($patrull) >= 2) break;
            if ($id !== $vakt['id'] && ($lastUsed[$id] ?? -100) < $i) {
                $patrull[] = $s;
                $lastUsed[$id] = $i;
            }
        }

        if (count($patrull) < 2) continue;

        $schema[] = [
            "time" => $timeLabel,
            "type" => "Vaktpost",
            "soldier" => $vakt['name']
        ];
        $schema[] = [
            "time" => $timeLabel,
            "type" => "Patrull",
            "soldier" => $patrull[0]['name'] . " & " . $patrull[1]['name']
        ];


        $prevVakt = $vakt;
    }

    return ["success" => true, "schema" => $schema];
}
