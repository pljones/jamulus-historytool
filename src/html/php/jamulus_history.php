<?php
/*

jamulus_history.php Parse Jamulus log lines to JSON

Copyright (C) 2011 Peter L Jones <peter@drealm.info>
Copyright (C) 2014 Peter L Jones <peter@drealm.info>
Copyright (C) 2020 Peter L Jones <peter@drealm.info>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

See LICENCE.txt for the full text.

 */
$jamulus_log = "/opt/Jamulus/log/Jamulus.log";

$lines     = isset($_GET['lines'])     ? $_GET['lines']               : 10;
$reverse   = isset($_GET['reverse'])   ? $_GET['reverse'] !== 'false' : TRUE;
$days      = isset($_GET['days'])      ? $_GET['days']                : 60;
$max_lines = isset($_GET['max_lines']) ? $_GET['max_lines']           : 20000;

$filearray = @file($jamulus_log);
if ($reverse) {
	# to the end
	$filearray = array_slice($filearray, count($filearray) <= $max_lines ? 0 : count($filearray) - $max_lines);
} else {
	# from the start
	$filearray = array_slice($filearray, 0, $max_lines);
}

$lastlines = array();

if ($filearray !== FALSE) {
	if (isset($_GET['lines']) || !isset($_GET['days'])) {
		if ($reverse) {
			# to the end
			$lastlines = array_slice($filearray, $lines * -1);
		} else {
			# from the start
			$lastlines = array_slice($filearray, 0, $lines);
		}
	} else {
		$reverse = FALSE; # not yet supported
		$earliest = (new DateTime())->sub(new DateInterval("P${days}D"))->format('Y-m-d');
		# Search backwards for $earliest
		for ($index = count($filearray) - 1; $index >= 0; --$index) {
			if ($filearray[$index] < $earliest) {
				# to the end
				$lastlines = array_slice($filearray, $index + 1);
				break;
			}
		}
	}

	# If nothing found, take everything
	if (count($lastlines) == 0) {
		$lastlines = $filearray;
	}
}

class result {
	public $type = "";
	public $datetime = "";
	public $host = "";
	public function __construct($type, $datetime, $host = "") { $this->type = trim($type); $this->datetime = trim($datetime); $this->host = trim($host); }
}

$result = array();
$current_count = 0;
#2020-07-19 23:43:45, 73.198.106.20, connected (8)
#2020-07-19 23:53:58,, server stopped -------------------------------------
#2020-07-19 23:57:08, 47.232.244.81, connected (1)
#2020-07-19 23:57:21,, server stopped -------------------------------------
#2020-07-20 02:16:40, 86.13.16.59, connected (1)
#2020-07-20 02:17:10,, server stopped -------------------------------------
while (count($lastlines) > 0) {
	$line = trim(array_shift($lastlines));
	$split = explode(',', $line, 3);
	if (count($split) != 3) {
		continue;
	}
	if (trim($split[1]) != '') {
		$a = explode(' ', trim($split[2]), 2);
		if (count($a) == 2) {
			$current_count = trim($a[1], '()');
		}
		$ip = explode('.', $split[1], 4);
		array_pop($ip);
		array_push($ip, "--");
		$result[] = new result("Connect", $split[0], implode('.', $ip));
	} else {
		$result[] = new result("Disconnect", $split[0]);
		$current_count = 0;
	}
}

echo json_encode(array( "jamulus_history" => ($reverse ? array_reverse($result) : $result), "jamulus_clients" => $current_count, "phpUpdated" => date("d F Y", filemtime($_SERVER['SCRIPT_FILENAME'])) ));
?>
