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
		$.get(url, function(data) {
			if (typeof data.jamulus_history !== 'undefined') {

				var svg_graph = history_graph.update(data.jamulus_history);
				hs_graph.html(svg_graph).show();

			}

		}, 'json');
	}

	$.timer(refresh, function(timer) { update_graph(url, refresh); timer.stop(); });
}

$(document).ready(function () {
	$('.no_script').hide(); // We're javascript, so we can...
	
	$.ajaxSetup({
		cache: false
	});

	hg_days = 60;
	if (typeof HistoryGraph !== 'undefined') {
		history_graph = new HistoryGraph(hg_days);
	} else {
		history_graph = undefined;
	}

	hs = $('#history');
	hs_wait = $('.wait', $('#hHistory'));
	hs_graph = $('#historyGraph');

	base = location.href.replace(/[^\/]*$/, '').replace(/\/*$/, ''); // anything from the last slash goes
	update_graph(base + '/php/jamulus_history?days=' + hg_days + '&reverse=false', 60000);
});
