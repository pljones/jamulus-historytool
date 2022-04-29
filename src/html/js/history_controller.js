/*

history_controler.js JQuery controller for History Graph
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
function update_graph(url, refresh) {

	if (typeof history_graph !== 'undefined') {
		$('#rendering_spinner').hide();
		$('#formatting_spinner').hide();
		$('#loading_failed').hide();
		$('#pre_spinner').show();
		$.get(url, function(data) {
			$('#pre_spinner').hide();
			if (typeof data.jamulus_history !== 'undefined') {
				$('#formatting_spinner').show();
				var svg_graph = history_graph.update(data.jamulus_history);
				$('#formatting_spinner').hide();

				$('#rendering_spinner').show();
				hs_graph.html(svg_graph).show();
				$('#rendering_spinner').hide();

			} else {
				$('#loading_failed').show();
			}

		}, 'json');
	}

	$.timer(refresh, function(timer) { update_graph(url, refresh); timer.stop(); });
}

$(document).ready(function () {
	$('.no_script').hide(); // We're javascript, so we can...
	$('#rendering_spinner').hide();
	$('#formatting_spinner').hide();
	$('#loading_failed').hide();
	$('#pre_spinner').show(); // Loading...

	$.ajaxSetup({
		cache: false
	});

	hg_days = dayjs().diff(dayjs('2014-11-04', 'YYYY-MM-DD'), 'days');
	if (typeof HistoryGraph !== 'undefined') {
		$('#sDays').html(hg_days);
		history_graph = new HistoryGraph(hg_days);
	} else {
		$('#sDays').html('--');
		history_graph = undefined;
		$('#loading_failed').show(); // Loading failed
	}

	hs = $('#history');
	hs_wait = $('.wait', $('#hHistory'));
	hs_graph = $('#historyGraph');

	base = location.href.replace(/[^\/]*$/, '').replace(/[\/]*$/, ''); // anything from the last slash goes
	update_graph(base + '/php/jamulus_history?days=' + hg_days + '&reverse=false&last=true&max_lines=100000', 60000);
});
