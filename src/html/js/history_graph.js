/*

history_graph.js Parse Jamulus history JSON to SVG graph

C++ version
Copyright (C)      Volker Fischer <corrados@users.noreply.github.com>
Copyright (C) 2019 Peter L Jones <peter@drealm.info>
Copyright (C) 2020 Peter L Jones <peter@drealm.info>
Copyright (C) 2020 Hector Martin <marcan@marcan.st>

Ported to JavaScript
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

//{

// Date class extensions

// return a new date 'days` into the future (negative for past)
Date.prototype.addDays = function (days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
};

// return number days to 'date' (past is negative)
Date.prototype.daysTo = function (date) {
  const utc1 = Date.UTC(this.getFullYear(), this.getMonth(), this.getDate());
  const utc2 = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
};
//}

// Minimal re-implementation of the Qt QXmlStreamWriter class
//
// This is NOT A SAFE IMPLEMENTATION!
// Any `writeCharacters` call should first ensure that the value passed
// is XML escaped.
//
// But it does pretty print quite nicely...
class SvgStreamWriter {
  svgImage;
  autoFormatting = false;

  elementStack = [];
  writingElement = 0;

  constructor(svgImage) {
        this.svgImage = svgImage;
  }

  getSvgImage() {
    return this.svgImage;
  }

  setAutoFormatting(autoFormatting) {
    this.autoFormatting = autoFormatting;
  }

  writeStartDocument() {
    this.svgImage += '<?xml version="1.0"?>\n';
    this.elementStack = [];
    this.writingElement = 0;
  }

  writeStartElement(Lement) {
    this._nextElement();
    this.writingElement = 1;

    this.svgImage +=
      (this.autoFormatting &&
      this.svgImage.length > 0 &&
      this.elementStack.length > 0
        ? '\n' + '    '.repeat(this.elementStack.length)
        : '') +
      '<' +
      Lement;
    this.elementStack.push('</' + Lement);
  }

  writeEmptyElement(Lement) {
    this._nextElement();
    this.writingElement = 2;

    this.svgImage +=
      (this.autoFormatting &&
      this.svgImage.length > 0 &&
      this.elementStack.length > 0
        ? '\n' + '    '.repeat(this.elementStack.length)
        : '') +
      '<' +
      Lement;
  }

  writeAttributes(attributes) {
    if (this.writingElement <= 0) {
      console.log('SvgStreamWriter.writeAttributes: No current element');
      return;
    }

    for (var k in attributes) {
      this.svgImage += ' ' + k + '="' + attributes[k] + '"';
    }
  }

  writeCharacters(value) {
    if (this.writingElement == 2) {
      console.log(
        'SvgStreamWriter.writeCharacters: Cannot add content to empty element'
      );
      return;
    }
    this._nextElement();
    this.writingElement = 3;
    this.svgImage += value;
  }

  writeEndElement() {
    this._nextElement();
    if (this.elementStack.length == 0) {
      console.log('SvgStreamWriter.writeEndElement: No open element to end');
      return;
    }

    const elementClose = this.elementStack.pop();
    this.svgImage +=
      (this.autoFormatting &&
      this.writingElement < 3 &&
      this.svgImage.length > 0
        ? '\n' + '    '.repeat(this.elementStack.length)
        : '') + elementClose;
    this.writingElement = this.svgImage.length > 0 ? 1 : 0;
  }

  writeEndDocument() {
    while (this.elementStack.length > 0) {
      this.writeEndElement();
    }
    this._nextElement();
    this.svgImage +=
      this.autoFormatting && this.svgImage.length > 0 ? '\n' : '';
  }

  _nextElement() {
    if (this.writingElement == 0) {
      return;
    }
    if (this.writingElement < 3) {
      this.svgImage +=
        (this.writingElement == 2
          ? (this.autoFormatting ? ' ' : '') + '/'
          : '') + '>';
      this.writingElement = 0;
    }
  }
}

//{
class HistoryItem {
  constructor(dateTime, type) {
        this.dateTime = new Date(dateTime.valueOf());
    this.type = type;
  }
}
HistoryItem.HIT_LOCAL_CONNECTION = 0;
HistoryItem.HIT_REMOTE_CONNECTION = 1;
HistoryItem.HIT_SERVER_STOP = 2;

HistoryItem.toType = function (clientInetAddr) {
  // distinguish between a local connection and a remote connection
  if (
    clientInetAddr === '127.0.0.1' ||
    clientInetAddr.startsWith('192.168.') ||
    (clientInetAddr >= '172.16.0.0' && clientInetAddr <= '172.31.255.255') ||
    clientInetAddr.startsWith('10.')
  ) {
    // local connection
    return HistoryItem.HIT_LOCAL_CONNECTION;
  } else {
    // remote connection
    return HistoryItem.HIT_REMOTE_CONNECTION;
  }
};
//}

class HistoryGraph {
  dayXSpace;

  constructor(histMaxDays) {
        this.histMaxDays = histMaxDays;

    //{
    // this lot could all be static
    this.backgroundColor = 'white'; // background
    this.frameColor = 'black'; // frame
    this.gridColor = 'gainsboro'; // Y-grid Mon-Fri
    this.gridColorDark = 'darkgrey'; // Y-grid Sat-Sun, X-grid
    this.textColor = 'black'; // text

    this.markerNewColor = 'darkCyan'; // marker for new connection
    this.markerNewLocalColor = 'blue'; // marker for new local connection
    this.markerStopColor = 'red'; // marker for server stop
    this.markerNewSize = 3; // not less than 2
    this.markerStopSize = 2; // not less than 2
    this.markerScale = 1.0;

    this.canvasRectX = 0;
    this.canvasRectY = 0;
    this.canvasRectHeight = 1440 + 120;
    this.canvasRectWidth = this.canvasRectHeight * 16 / 9;

    this.axisFontFamily = 'Arial';
    this.axisFontWeight = '100';
    this.axisFontSize = '3rem';
    this.textOffsetToGrid = 6;
    this.xAxisTextHeight = 36;

    this.gridFrameOffset = 10;

    this.gridFrameX = this.canvasRectX + this.gridFrameOffset;
    this.gridFrameY = this.canvasRectY + this.gridFrameOffset;
    this.gridFrameWidth = this.canvasRectWidth - 2 * this.gridFrameOffset;
    this.gridFrameHeight =
      this.canvasRectHeight - 2 * this.gridFrameOffset - this.xAxisTextHeight;
    this.gridFrameRight = this.gridFrameX + this.gridFrameWidth - 1;
    this.gridFrameBottom = this.gridFrameY + this.gridFrameHeight/* - 0*/;

    this.yAxisStart = 0;
    this.yAxisEnd = 24;
    this.numTicksY = 5;
    this.bottomExtraTickLen = 12;

    this.hourYSpace = (0.0 + this.gridFrameHeight/* - this.markerNewSize * 0*/) / ( this.yAxisEnd - this.yAxisStart );

    this.svgRootAttributes = {
      viewBox:
        this.canvasRectX +
        ', ' +
        this.canvasRectY +
        ', ' +
        this.canvasRectWidth +
        ', ' +
        this.canvasRectHeight,
      xmlns: 'http://www.w3.org/2000/svg',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    };
    //}
  }

  /*
   * Given the response from
   * 'http://jamulus.drealm.info/php/jamulus_history?days=60' is {
   * "jamulus_history": [ {"type": "Connect","datetime": "2020-08-04
   * 19:07:44","host": "192.168.1.--"}, {"type": "Disconnect","datetime":
   * "2020-08-04 20:08:49","host": ""}, ], "jamulus_clients": 0, "phpUpdated": "08
   * August 2020" } call update with response.jamulus_history
   */
  update(jamulusHistory) {
//    console.log(new Date().toISOString() + ': update begin');
    const updateBegin = new Date();

    var historyData = [];
    for (var i = 0; i < jamulusHistory.length; ++i) {
      if (jamulusHistory[i].type === 'Connect') {
        historyData.push(
          new HistoryItem(
            jamulusHistory[i].datetime,
            HistoryItem.toType(jamulusHistory[i].host)
          )
        );
      } else {
        historyData.push(
          new HistoryItem(
            jamulusHistory[i].datetime,
            HistoryItem.HIT_SERVER_STOP
          )
        );
      }
    }

    // create SVG document
    var svgStreamWriter = new SvgStreamWriter('');
    svgStreamWriter.setAutoFormatting(true);
    //svgStreamWriter.writeStartDocument(); // Not wanted for inline SVG
    svgStreamWriter.writeStartElement('svg');
    svgStreamWriter.writeAttributes(this.svgRootAttributes);
    svgStreamWriter.writeAttributes({
      alt: 'Jamulus history graph for latest ' + this.histMaxDays + ' days', // ?
      title: 'Jamulus history graph',
    });

    // store current date for reference
    var curDate = new Date();
    curDate.setHours(0, 0, 0, 0);

    // get oldest date in history
    var oldestDate = curDate.addDays(1); // one day in the future

    const numItemsForHistory = historyData.length;

    var i;
    for (i = 0; i < numItemsForHistory; ++i) {
      if (historyData[i].dateTime < oldestDate) {
        oldestDate = historyData[i].dateTime;
      }
    }

    // set oldest date to draw
    var minDate = curDate.addDays(this.histMaxDays * -1);
    if (oldestDate < minDate) {
      oldestDate = minDate;
    }

    const numDaysInHistory = -curDate.daysTo(oldestDate) + 1;
//    console.log(new Date().toISOString() + ': HistoryGraph.update: numItemsForHistory ' + numItemsForHistory
//      + ', curDate ' + curDate.toISOString() + ', oldestDate ' + oldestDate.toISOString()
//      + ', minDate ' + minDate.toISOString() + ', numDaysInHistory ' + numDaysInHistory);

    // draw frame of the graph
    this._drawFrame(svgStreamWriter, curDate, numDaysInHistory);

    // determine mark scaling factor
    this.markerScale = ((1.0 * Math.max(this.gridFrameHeight, this.gridFrameWidth)) / Math.max(24, numDaysInHistory)) / 3;

    // add markers
    for (i = 0; i < numItemsForHistory; i++) {
      if (oldestDate <= historyData[i].dateTime) {
        this._addMarker(svgStreamWriter, historyData[i], curDate, numDaysInHistory);
      }
    }

    svgStreamWriter.writeEndDocument();

    const updateEnd = new Date();
//    console.log(new Date().toISOString() + ': update end: ' + (updateEnd.getTime() - updateBegin.getTime()) + 'ms');

    return svgStreamWriter.getSvgImage();
  }

  _drawFrame(svgStreamWriter, curDate, numTicksX) {
    var i;

    // Create actual plot region (grid frame)
    // ----------------------------------
    this._rect(
      svgStreamWriter,
      this.gridFrameX,
      this.gridFrameY,
      this.gridFrameWidth,
      this.gridFrameHeight
    );

    // calculate step for x-axis ticks so that we get the desired number of
    // ticks -> 5 ticks
    const xAxisTickStep = Math.floor(numTicksX / 5) + 1;

    // grid (ticks) for x-axis
    this.dayXSpace = 0.0 + this.gridFrameWidth / (numTicksX + 1);

    for (i = 0; i < numTicksX; ++i) {
      var bottom = this.gridFrameBottom;
      const curX = this.gridFrameX + Math.max(1, Math.floor(this.dayXSpace * (i + 1)));
      const curXAxisDate = curDate.addDays(i + 1 - Math.floor(numTicksX));

      // label every "xAxisTickStep" tick with MM-DD
      // (YYYY-MM-DD).substring(6, 5)
      if (i % xAxisTickStep == 0) {
        var cd = curXAxisDate.toISOString();
        this._text(
          svgStreamWriter,
          curX,
          this.gridFrameBottom + this.xAxisTextHeight,
          cd.substring(0, 10)//cd.substring(8, 10) + '.' + cd.substring(5, 7)
        );
        bottom += this.bottomExtraTickLen;
      }

      // regular grid
      var color = this.gridColor;

      // different grid color for weekends
      if (
        curXAxisDate.getDay() == 6 /* Saturday */ ||
        curXAxisDate.getDay() == 0 /* Sunday */
      ) {
        color = this.gridColorDark;
      }

      this._line(
        svgStreamWriter,
        curX,
        this.gridFrameY,
        curX,
        bottom,
        color
      );

    }

    // grid (ticks) for y-axis, draw numTicksY - 2 grid lines and
    // numTicksY - 1 text labels (the lowest grid line is the grid frame)
    var ySpace = Math.floor(this.gridFrameHeight / (this.numTicksY - 1));

    for (i = 0; i < Math.floor(this.numTicksY) - 1; ++i) {
      const curY = this.gridFrameY + ySpace * (i + 1);

      // labels
      this._text(
        svgStreamWriter,
        this.gridFrameX + this.textOffsetToGrid,
        curY - this.textOffsetToGrid,
        '' +
          Math.floor(
            ((this.yAxisEnd - this.yAxisStart) / (this.numTicksY - 1)) *
              (this.numTicksY - 2 - i)
          ) +
          ':00'
      );

      // grid (do not overwrite frame)
      if (i < this.numTicksY - 2) {
        this._line(
          svgStreamWriter,
          this.gridFrameX,
          curY,
          this.gridFrameRight,
          curY,
          this.gridColorDark
        );
      }
    }
  }

  _addMarker(svgStreamWriter, curHistoryData, curDate, numTicksX) {
    // calculate x-axis offset (difference of days compared to
    // current date)
    const xAxisOffs = numTicksX + curDate.daysTo(curHistoryData.dateTime);

    // check range, if out of range, do not plot anything
    if (xAxisOffs > numTicksX) {
      console.log(new Date().toISOString() + ': _addMarker: history item off graph: ' + curHistoryData.dateTime.toISOString());
      return;
    }

    // calculate y-axis offset (consider hours and minutes)
    const yAxisOffs = 24.0 - (
      ( 60.0 * curHistoryData.dateTime.getHours() + curHistoryData.dateTime.getMinutes() )
    / 60.0);

    // calculate the actual point in the graph (in pixels)
    var curPointX = this.gridFrameX - 1/* - frame + frame offset */ + Math.max(1, Math.floor( this.dayXSpace  * xAxisOffs ));
    var curPointY = this.gridFrameY - 1/* - frame + frame offset */ + Math.max(1, Math.floor( this.hourYSpace * yAxisOffs ));

    var curPointColour = this.markerNewColor;
    var curPointSize = this.markerNewSize;

    // we use different markers for new connection and server stop items
    switch (curHistoryData.type) {
      case HistoryItem.HIT_SERVER_STOP:
        curPointColour = this.markerStopColor;
        curPointSize = this.markerStopSize;
        break;

      case HistoryItem.HIT_LOCAL_CONNECTION:
        curPointColour = this.markerNewLocalColor;
        break;

      case HistoryItem.HIT_REMOTE_CONNECTION:
        curPointColour = this.markerNewColor;
        break;
    }

    // apply scaling factor
    curPointSize = Math.max(curPointSize, Math.floor(this.markerScale * curPointSize));

    this._point(
      svgStreamWriter,
      curPointX - Math.max(1, Math.floor(curPointSize / 2.0)),
      curPointY - Math.max(1, Math.floor(curPointSize / 2.0)),
      curPointSize,
      curPointColour
    );
  }

  _rect(svgStreamWriter, x, y, width, height) {
    svgStreamWriter.writeEmptyElement('rect');
    svgStreamWriter.writeAttributes({
      x: x,
      y: y,
      width: width,
      height: height,
    });
    svgStreamWriter.writeAttributes({
      stroke: this.frameColor,
      'stroke-width': '1',
      style: 'fill: none;',
    });
  }

  _text(svgStreamWriter, x, y, value) {
    svgStreamWriter.writeStartElement('text');
    svgStreamWriter.writeAttributes({ x: x, y: y });
    svgStreamWriter.writeAttributes({ stroke: this.textColor });
    svgStreamWriter.writeAttributes({
      'font-family': this.axisFontFamily,
      'font-weight': this.axisFontWeight,
      'font-size': this.axisFontSize,
    });
    svgStreamWriter.writeCharacters(value);
    svgStreamWriter.writeEndElement();
  }

  _line(svgStreamWriter, x1, y1, x2, y2, strokeColor, strokeWidth = 1) {
    svgStreamWriter.writeEmptyElement('line');
    svgStreamWriter.writeAttributes({ x1: x1, y1: y1, x2: x2, y2: y2 });
    svgStreamWriter.writeAttributes({
      stroke: strokeColor,
      'stroke-width': strokeWidth,
    });
  }

  _point(svgStreamWriter, x, y, size, colour) {
    svgStreamWriter.writeEmptyElement('rect');
    svgStreamWriter.writeAttributes({ x: x, y: y, width: size, height: size });
    svgStreamWriter.writeAttributes({ 'stroke-opacity': '0' });
    svgStreamWriter.writeAttributes({ fill: colour });
  }
}
