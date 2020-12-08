var log = console.log.bind(console);
console.clear();

(function ($) {
  $.fn.analogTank = function (config) {
    let $this = $(this);

    return new AnalogTank($this, config);
  };

  class AnalogTank {
    constructor($this, config) {
      let defaults = {
        tankType: "tower", // available types: 'tower', 'round'
        tankWidth: null, // outside width.
        tankHeight: null, // outside height.
        fillPadding: null, // gap between perimeter and inside tank area that displays water.
        borderWidth: 2, // perimeter width.
        borderColor: "#333", // outside border color. usually the perimeter of the tank
        defaultFillColor: "#3fabd4", // default water color. this is assigned to fillColor if water level does not pass any thresholds.
        fillColor: null, // used later to set water color. it could be different color depending on situations.
        backFillColor: "#fafafa", // background color inside the tank where there is no water.
        backFillOpacity: 1, // opacity of the background.
        innerCornerRadius: 3,
        borderCornerRadius: 5,
        innerWidth: null,
        innerHeight: null,
        neckWidth: 50, // only applies to round tank
        neckHeight: 50, // only applies to round tank
        fillAnimationColor: null, // used later to set the color while animating.
        fillMaxValue: 100, // maximum possible value for the main text.
        fillMinValue: 0, // minimum possible value for the main text.
        fillValue: null, // value used to display the main text.
        fillUnit: null, // unit that is appended to the main text.
        decimal: 1, // number of decimal places for the main text.
        overlayTextFillOpacity: 0.8, // opacity of the main text.
        arrow: true, // arrow that is displayed to the right of the main text.
        fontFamily: "Helvetica",
        fontWeight: "bold",
        fontSize: 20,
        backFontColor: null,
        backFontAnimationColor: null,
        frontFontColor: null,
        waveWidth: 100,
        amplitude: 3,
        horizontalWaveDuration: 2000,
        transitionDuration: 1000,
        delay: 0,
        ease: d3.easePolyInOut.exponent(4),
        marker: true,
        markerPosition: "in",
        markerGap: [5, 3],
        markerLabelXOffset: 0,
        markerLabelYOffset: 0,
        markerWidth: 2,
        markerLength: 10,
        topMarkerText: null,
        topMarkerColor: "#133440",
        topMarkerFontColor: "#133440",
        bottomMarkerText: null,
        bottomMarkerColor: "#133440",
        bottomMarkerFontColor: "#133440",
        markerFontSize: 10,
        markerFontWeight: "bold",
        markerFontFamily: "Helvetica",
        enableSupportLabel: true,
        supportLabelFontColor: "#133440",
        supportLabelFontFamily: "Helvetica",
        supportLabelFontWeight: "bold",
        supportLabelFontSize: 14,
        supportLabelText: "NA",
        supportLabelYOffset: -1,
        mergeSupportLabelToBorder: false,
        dualSupportLabel: false,
        topSupportLabelFontColor: "#133440",
        topSupportLabelFontFamily: "Helvetica",
        topSupportLabelFontWeight: "bold",
        topSupportLabelFontSize: 14,
        topSupportLabelText: "NA",
        topSupportLabelYOffset: -1,
        enableSupportLabelBg: true,
        supportLabelBackgroundColor: "#fff",
        supportLabelBackgroundOpacity: 0.7,
        supportLabelBackgroundHeight: null,
        supportLabelBackgroundWidth: null,
        supportLabelBackgroundBorderWidth: 1,
        supportLabelBackgroundBorderColor: null,
        supportLabelPadding: 0,
        supportLabelWidthFix: 0,
        arrowName: null,
        upArrowName: "\uf176",
        downArrowName: "\uf175",
        noArrowName: "\uf07e",
        arrowFontFamily: "FontAwesome",
        arrowFontWeight: "bold",
        arrowFontSize: 12,
        arrowXOffset: 3,
        arrowYOffset: -1,
        topFillBackArrowColor: null,
        bottomFillBackArrowColor: null,
        frontArrowColor: null,
        backArrowColor: null,
        markerBarXOffset: 3,
        tooltipFontSize: 10,
        thresholds: [],
        lookupTableValue: null, // if lookup table value is set, a secondary text is displayed under the main text.
        lookupTableValueUnit: null, // unit for lookupTableValue.
        lookupTableValueDecimal: 0, // number of decimal places for lookup table value.
        lookupTableValueEnabled: false,
        lookupTableValueFontSize: 14,
        lookupTableValueYOffset: 2,
        changeRateValueArrowEnabled: false,
        changeRateValueArrowYOffset: 0,
        changeRateValue: null,
        changeRateValueDecimal: 0,
        changeRateValueEnabled: false,
        changeRateValueFontSize: 14,
        changeRateValueYOffset: 2,
        changeRateValueUnit: 'gal/min'
      };
      Object.assign(defaults, config);

      this.container = $this;
      Object.assign(this, defaults);
      this.url = window.location.href;

      if (this.tankType !== 'tower' && this.tankType !== 'round') {
        throw new Error(`Unknown Tank Type specified: ${this.tankType}. Should be either 'tower' or 'round'.`);
      }

      this.init();
    }

    // initializer
    init() {
      this.setInitialValues();
      this.drawSvgContainer();

      if ( this.tankType === "tower" ) {
        this.initTower();
      } else if ( this.tankType === "round" ) {
        this.initRound();
      }

      this.setMarkerAttributes();
      this.calculateDimensions();
      this.setGaugeScale();
      this.getNewHeight();
      this.addThresholdMarkers();
      this.applyFillAttributes();
      this.applyTextAttributes();
      this.applyWaveHorizontalAttributes();
      this.applySupportLabelAttributes();
      this.updateArrowPosition();
      this.tweenWaveHorizontal();
      this.animateFromZero();
      this.repositionElements();
      this.setBisector();
      this.hover();
    }

    drawSvgContainer() {
      this.width = this.container.outerWidth();
      this.height = this.container.outerHeight();
      let viewBoxDef = `0, 0, ${this.width}, ${this.height}`;

      this.svgContainer = d3.select(this.container[0])
        .attr('id', 'svg-container')
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", viewBoxDef);

      this.bodyGroup = this.svgContainer.append('g')
        .attr('id', 'body-group')
        .attr('transform', `translate(${this.width/2}, ${this.height/2})`);
    }

    // scale that returns pixel value for positioning the waveClip vertically
    setGaugeScale () {
      this.gaugeScale = d3.scaleLinear()
        .domain([this.fillMinValue, this.fillMaxValue])
        .range([(this.innerHeight + this.amplitude)/2, -(this.innerHeight + this.amplitude)/2])
        .clamp(true);
    }

    getNewHeight () {
      this.newHeight = this.fillValue === null ? 0 : this.gaugeScale(this.fillValue);
    }

    initTower () {
      let uniqId = this.uniqId();
      // this.tankGroup = this.bodyGroup.append('g').attr('id', 'tank-group');
      this.waveClip = this.bodyGroup.append('defs').append('clipPath').attr('id', uniqId);
      this.waveHorizontal = this.waveClip.append('path');

      this.backFill = this.bodyGroup.append('rect').attr('id', 'back-fill');
      this.border = this.bodyGroup.append('rect').attr('id', 'border');
      this.behindText = this.bodyGroup.append('text').attr('id', 'behind-text');
      this.behindArrow = this.bodyGroup.append('text').attr('id', 'behind-arrow');

      if (this.lookupTableValueEnabled) {
        this.lookupTableValueBehindText = this.bodyGroup.append('text').attr('id', 'lookup-value-behind-text');
      }

      if (this.changeRateValueEnabled) {
        this.changeRateValueBehindText = this.bodyGroup.append('text').attr('id', 'change-rate-value-behind-text');
      }

      this.waveGroup = this.bodyGroup.append('g').attr('clip-path', this.getUniqUrl(uniqId));
      this.waterFill = this.waveGroup.append('rect').attr('id', 'water-fill');

      this.overlayText = this.waveGroup.append('text').attr('id', 'overlay-text');
      this.overlayArrow = this.waveGroup.append('text').attr('id', 'overlay-arrow');

      if (this.lookupTableValueEnabled) {
        this.lookupTableValueOverlayText = this.waveGroup.append('text').attr('id', 'lookup-value-overlay-text');
      }

      if (this.changeRateValueEnabled) {
        this.changeRateValueOverlayText = this.waveGroup.append('text').attr('id', 'change-rate-value-overlay-text');
      }

      this.supportLabelGroup = this.bodyGroup.append('g').attr('id', 'support-label-group');
      this.supportLabelBg = this.supportLabelGroup.append('rect').attr('id', 'support-label-bg');
      this.supportLabel = this.supportLabelGroup.append('text').attr('id', 'overlay-support-label');
      this.topSupportLabel = this.supportLabelGroup.append('text').attr('id', 'top-overlay-support-label');

      this.topMarkerLabel = this.bodyGroup.append('text').attr('id', 'top-marker-label');
      this.bottomMarkerLabel = this.bodyGroup.append('text').attr('id', 'bottom-marker-label');
      this.markerBarGroup = this.bodyGroup.append('g').attr('id', 'marker-bar-group');
      // for debug purpose
      // this.bodyGroup.append('path').attr('d', 'M-${this.height/2} 0 L ${this.height} 0').attr('stroke-width', 1).attr('stroke', 'red');
    }

    initRound () {
      let that = this;
      let uniqId = this.uniqId();
      this.tankGroup = this.bodyGroup.append('g').attr('id', 'tank-group');
      this.waveClip = this.bodyGroup.append('defs').append('clipPath').attr('id', uniqId);
      this.waveHorizontal = this.waveClip.append('path');

      this.backFill = this.tankGroup.append('ellipse').attr('id', 'back-fill');
      this.border = this.tankGroup.append('ellipse').attr('id', 'border');
      this.neckBackFill = this.tankGroup.append('path').attr('id', 'neck-back-fill');
      this.behindText = this.tankGroup.append('text').attr('id', 'behind-text');
      this.behindArrow = this.tankGroup.append('text').attr('id', 'behind-arrow');

      if (this.lookupTableValueEnabled) {
        this.lookupTableValueBehindText = this.tankGroup.append('text').attr('id', 'lookup-value-behind-text');
      }

      if (this.changeRateValueEnabled) {
        this.changeRateValueBehindText = this.tankGroup.append('text').attr('id', 'lookup-value-rate-behind-text');
      }

      this.waveGroup = this.tankGroup.append('g').attr('clip-path', this.getUniqUrl(uniqId));
      this.neckFill = this.waveGroup.append('path').attr('id', 'neck-fill');
      this.waterFill = this.waveGroup.append('ellipse').attr('id', 'water-fill');
      this.neckBorder = this.tankGroup.append('path').attr('id', 'neck-border');

      this.overlayText = this.waveGroup.append('text').attr('id', 'overlay-text');
      this.overlayArrow = this.waveGroup.append('text').attr('id', 'overlay-arrow');

      if (this.lookupTableValueEnabled) {
        this.lookupTableValueOverlayText = this.waveGroup.append('text').attr('id', 'lookup-value-overlay-text');
      }

      if (this.changeRateValueEnabled) {
        this.changeRateValueOverlayText = this.waveGroup.append('text').attr('id', 'lookup-value-rate-overlay-text');
      }

      this.supportLabelGroup = this.bodyGroup.append('g').attr('id', 'support-label-group');
      this.supportLabelBg = this.supportLabelGroup.append('rect').attr('id', 'support-label-bg');
      this.supportLabel = this.supportLabelGroup.append('text').attr('id', 'overlay-support-label');
      this.topSupportLabel = this.supportLabelGroup.append('text').attr('id', 'top-overlay-support-label');

      this.topMarker = this.tankGroup.append('line').attr('id', 'top-marker');
      this.bottomMarker = this.tankGroup.append('line').attr('id', 'bottom-marker');
      this.topMarkerLabel = this.tankGroup.append('text').attr('id', 'top-marker-label');
      this.bottomMarkerLabel = this.tankGroup.append('text').attr('id', 'bottom-marker-label');
      this.markerBarGroup = this.tankGroup.append('g').attr('id', 'marker-bar-group');
    }

    // sets the inital text and color to display based on fillValue
    setInitialValues () {
      this.lookupTableValueEnabled = this.lookupTableValue !== null ? true : false;
      this.changeRateValueEnabled = this.changeRateValue !== null ? true : false;

      this.fillColor = this.defaultFillColor;

      this.topMarkerText = this.topMarkerText === null ? this.fillMaxValue.toString() : this.topMarkerText;
      this.bottomMarkerText = this.bottomMarkerText === null ? this.fillMinValue.toString() : this.bottomMarkerText;
      this.topMarkerFontColor = this.tankType === 'tower' ? '#000' : '#fafafa';
      this.bottomMarkerFontColor = this.tankType === 'tower' ? '#000' : '#fafafa';
    }

    setMarkerAttributes() {
      this.applyAttributes(this.topMarkerLabel, {
        'text-anchor': 'end',
        'font-family': this.markerFontFamily,
        'font-size': `${this.markerFontSize}px`,
        fill: this.topMarkerFontColor,
        'font-weight': this.markerFontWeight,
        text: this.topMarkerText
      });

      this.applyAttributes(this.bottomMarkerLabel, {
        'text-anchor': 'end',
        'font-family': this.markerFontFamily,
        'font-size': `${this.markerFontSize}px`,
        fill: this.bottomMarkerFontColor,
        'font-weight': this.markerFontWeight,
        text: this.bottomMarkerText
      });

    }

    calculateDimensions() {
      this.markerLabelWidth = this.getMaxWidth(this.topMarkerLabel, this.bottomMarkerLabel);
      let markerGapSum = this.markerGap[0] + this.markerGap[1];

      if (this.tankType === 'tower') {
        this.tankWidth = this.width - this.borderWidth;
        this.tankHeight = this.height - this.borderWidth;

        if ( this.fillPadding !== null && typeof this.fillPadding === "number" && this.fillPadding !== 0 ) {
          this.innerWidth = this.tankWidth - 2*this.fillPadding; // in case there is a padding, this will be the inner fill part
          this.innerHeight = this.tankHeight - 2*this.fillPadding; // same as above
        } else {
          this.innerWidth = this.tankWidth - this.borderWidth;
          this.innerHeight = this.tankHeight - this.borderWidth;
        }

      } else if (this.tankType === 'round') {
        this.tankWidth = this.width - 2*(this.borderWidth + this.markerLabelWidth); // this is how wide the tank will draw
        this.tankHeight = this.height - this.borderWidth - this.neckHeight; // this is how tall the round part of the tank will draw

        if ( this.fillPadding !== null && typeof this.fillPadding === "number" && this.fillPadding !== 0 ) {
          this.innerWidth = this.tankWidth - 2*this.fillPadding; // in case there is a padding, this will be the inner fill part
          this.innerHeight = this.tankHeight - 2*this.fillPadding; // same as above
        } else {
          this.innerWidth = this.tankWidth - this.borderWidth;
          this.innerHeight = this.tankHeight - this.borderWidth;
        }

        //subtract the support height use the minimum value
        this.tankRx = this.tankWidth/2;
        this.tankRy = this.tankHeight/2;
        this.innerRx = this.innerWidth/2;
        this.innerRy = this.innerHeight/2;
      }
    }

    addThresholdMarkers() {
      let topPixelPosition = this.gaugeScale(this.fillMaxValue) + this.borderWidth;
      let color = this.tankType === 'round' ? '#fafafa' : '#000';

      if (this.tankType === 'round') {
        this.markerBarGroup.append('line')
          .attr('id', 'top-edge-marker')
          .attr('x1', -this.markerLength-4)
          .attr('x2', 1)
          .attr('y1', topPixelPosition)
          .attr('y2', topPixelPosition)
          .attr('stroke-width', 1)
          .attr('stroke', color)
          .attr('stroke-linecap', 'round');

        let bottomPixelPosition = this.gaugeScale(this.fillMinValue) - this.borderWidth;
        this.markerBarGroup.append('line')
          .attr('id', 'bottom-edge-marker')
          .attr('x1', -this.markerLength-4)
          .attr('x2', 1)
          .attr('y1', bottomPixelPosition)
          .attr('y2', bottomPixelPosition)
          .attr('stroke-width', 1)
          .attr('stroke', color)
          .attr('stroke-linecap', 'round');

        this.markerBar = this.markerBarGroup.append('line')
          .attr('id', 'marker-bar')
          .attr('x1', 1)
          .attr('x2', 1)
          .attr('y1', topPixelPosition)
          .attr('y2', bottomPixelPosition)
          .attr('stroke-width', 1)
          .attr('stroke', color);
      }

      this.thresholdMarkerPositions = [];
      this.thresholdTooltips = [];
      this.thresholdMarkers = [];

      this.thresholds.forEach( (threshold, i) => {
        let id = this.uniqId();
        let pixelPosition = this.gaugeScale(threshold.value);

        let marker = this.markerBarGroup.append('line')
          .datum({ yCoord: pixelPosition, strokeWidth: this.markerWidth, x1: -this.markerLength })
          .attr('id', `threshold-marker-${id}`)
          .attr('x1', -this.markerLength)
          .attr('x2', 0)
          .attr('y1', pixelPosition)
          .attr('y2', pixelPosition)
          .attr('stroke-width', this.markerWidth)
          .attr('stroke', threshold.alarm ? 'red' : color);

        let tooltip = d3.select(this.container[0]).append('div')
          .datum({ name: threshold.name, value: threshold.value, type: threshold.type })
          .html(function(d) { return '<div>Name: ' + d.name + '</div>' + '<div>Value: ' + d.value + '</div>' + '<div>Type: ' + d.type + '</div>'; })
          .attr('id', `tooltip-${id}`)
          .style('position', 'absolute')
          .style('right', `${this.markerLabelWidth*2}px`)
          .style('top', `${pixelPosition + this.innerHeight/2 - 30}px`)
          .style('padding', '8px')
          .style('background', 'rgba(97,97,97,0.9)')
          .style('color', '#fff')
          .style('font-family', "'Roboto', 'Helvetica', 'Arial', sans-serif")
          .style('font-size', '10px')
          .style('display', 'initial')
          .style('-webkit-animation', 'pulse 200ms cubic-bezier(0, 0, 0.2, 1) forwards')
          .style('animation', 'pulse 200ms cubic-bezier(0, 0, 0.2, 1) forwards');

        if (this.thresholdMarkers.length > 0) {
          this.thresholdMarkerPositions.push({ yCoord: (this.thresholdMarkers[i-1].datum().yCoord + pixelPosition)/2 });
        }

        this.thresholdTooltips.push(tooltip);
        this.thresholdMarkers.push(marker);

        tooltip.style('display', 'none');
      });
    }

    applyFillAttributes() {
      if (this.tankType === 'tower') {
        this.applyAttributes(this.backFill, {
          x: 0,
          y: 0,
          width: this.innerWidth,
          height: this.innerHeight,
          rx: this.innerCornerRadius,
          ry: this.innerCornerRadius,
          fill: this.backFillColor,
          'fill-opacity': this.backFillOpacity,
          transform: `translate(-${(this.tankWidth - this.borderWidth)/2}, -${(this.tankHeight - this.borderWidth)/2})`
        });

        this.applyAttributes(this.waterFill, {
          datum: { color: this.fillColor },
          x: 0,
          y: 0,
          width: this.innerWidth,
          height: this.innerHeight,
          rx: this.innerCornerRadius,
          ry: this.innerCornerRadius,
          fill: function(d) { return d.color; },
          transform: `translate(-${(this.tankWidth - this.borderWidth)/2}, -${(this.tankHeight - this.borderWidth)/2})`
        });

        this.applyAttributes(this.border, {
          x: 0,
          y: 0,
          width: this.tankWidth,
          height: this.tankHeight,
          rx: this.borderCornerRadius,
          ry: this.borderCornerRadius,
          'fill-opacity': 0,
          stroke: this.borderColor,
          'stroke-width': this.borderWidth,
          transform: `translate(-${this.tankWidth/2}, -${this.tankHeight/2})`
        });
      } else if (this.tankType === 'round') {
        this.applyAttributes(this.tankGroup, {
          transform: `translate(0, -${this.height/2 - this.tankRy - this.borderWidth/2})`
        });

        this.applyAttributes(this.backFill, {
          cx: 0,
          cy: 0,
          rx: this.innerRx,
          ry: this.innerRy,
          fill: this.backFillColor
        });

        this.applyAttributes(this.waterFill, {
          datum: { color: this.fillColor },
          cx: 0,
          cy: 0,
          rx: this.innerRx,
          ry: this.innerRy,
          fill: this.fillColor
        });

        this.applyAttributes(this.border, {
          cx: 0,
          cy: 0,
          rx: this.tankRx,
          ry: this.tankRy,
          'fill-opacity': 0,
          stroke: this.borderColor,
          'stroke-width': this.borderWidth
        });

        let xCoord = this.getXCoordOfEllipse(this.tankRy/8*7);

        let topRight = `${xCoord} ${this.tankRy/8*7}`;
        let bottomRight = `${this.tankRx/4} ${this.height - this.tankRy - this.borderWidth/2}`;

        let topLeft = `-${xCoord} ${this.tankRy/8*7}`;
        let bottomLeft = `-${this.tankRx/4} ${this.height - this.tankRy - this.borderWidth/2}`;

        let topRightInflectionPt = `${this.tankRx/4} ${this.tankRy}`;
        let bottomRightInflectionPt = `${this.tankRx/4} ${this.tankRy}`;
        let topLeftInflectionPt = `-${this.tankRx/4} ${this.tankRy}`;
        let bottomLeftInflectionPt = `-${this.tankRx/4} ${this.tankRy}`;

        // for debug purpose
        // let topRightInfxPt = this.tankGroup.append('circle').attr('r', 2).attr('fill','red').attr('transform', `translate(${topRightInflectionPt})`);
        // let bottomRightInfxPt = this.tankGroup.append('circle').attr('r', 2).attr('fill','red').attr('transform', `translate(${bottomRightInflectionPt})`);

        let neckFillPathDef = `M${topRight}, C${topRightInflectionPt}, ${bottomRightInflectionPt}, ${bottomRight}, L${bottomLeft}, C${bottomLeftInflectionPt}, ${topLeftInflectionPt}, ${topLeft} Z`;
        let neckBorderDef = `M${topRight}, C${topRightInflectionPt}, ${bottomRightInflectionPt}, ${bottomRight}, L${bottomLeft}, C${bottomLeftInflectionPt}, ${topLeftInflectionPt}, ${topLeft}`;

        this.applyAttributes(this.neckFill, {
          datum: { color: this.fillColor },
          d: neckFillPathDef,
          fill: this.fillColor,
        });

        this.applyAttributes(this.neckBorder, {
          d: neckBorderDef,
          stroke: this.borderColor,
          fill: 'transparent',
          'stroke-width': this.borderWidth
        });

        this.applyAttributes(this.neckBackFill, {
          d: neckFillPathDef,
          fill: this.backFillColor,
          'stroke-width': 0
        });
      }
    }

    applyTextAttributes() {
      let transform = `translate(0, ${this.fontSize/4})`;

      this.applyAttributes(this.behindText, {
        datum: { color: this.backFontColor === null ? this.fillColor : this.backFontColor },
        'text-anchor': 'middle',
        'font-family': this.fontFamily,
        'font-size': `${this.fontSize}px`,
        'font-weight': this.fontWeight,
        fill: function(d) { return d.color; },
        text: `0 ${this.fillUnit}`,
        transform: transform
      });

      this.applyAttributes(this.behindArrow, {
        datum: { color: this.backFontColor === null ? this.fillColor : this.backFontColor },
        'text-anchor': 'middle',
        'font-family': this.arrowFontFamily,
        'font-size': `${this.arrowFontSize}px`,
        'font-weight': this.arrowFontWeight,
        fill: function(d) { return d.color; },
        text: `${this.arrowName === null ? this.noArrowName : this.arrowName}`,
      });

      this.applyAttributes(this.overlayText, {
        datum: { color: this.frontFontColor === null ? "#fff" : this.frontFontColor },
        'text-anchor': 'middle',
        'font-family': this.fontFamily,
        'font-size': `${this.fontSize}px`,
        'font-weight': this.fontWeight,
        fill: function(d) { return d.color; },
        'fill-opacity': this.overlayTextFillOpacity,
        text: `0 ${this.fillUnit}`,
        transform: transform
      });

      this.applyAttributes(this.overlayArrow, {
        datum: { color: this.frontFontColor },
        'text-anchor': 'middle',
        'font-family': this.arrowFontFamily,
        'font-size': `${this.arrowFontSize}px`,
        'font-weight': this.arrowFontWeight,
        fill: function(d) { return d.color; },
        text: `${this.arrowName === null ? this.noArrowName : this.arrowName}`,
      });

      if (this.lookupTableValueEnabled) {
        let lookupTransform = `translate(0, ${this.fontSize/4 + this.lookupTableValueFontSize + this.lookupTableValueYOffset})`;

        this.applyAttributes(this.lookupTableValueBehindText, {
          datum: { color: this.backFontColor === null ? this.fillColor : this.backFontColor },
          'text-anchor': 'middle',
          'font-family': this.fontFamily,
          'font-size': `${this.lookupTableValueFontSize}px`,
          'font-weight': this.fontWeight,
          fill: function(d) { return d.color; },
          text: `0 ${this.lookupTableValueUnit}`,
          transform: lookupTransform
        });

        this.applyAttributes(this.lookupTableValueOverlayText, {
          datum: { color: this.frontFontColor === null ? "#fff" : this.frontFontColor },
          'text-anchor': 'middle',
          'font-family': this.fontFamily,
          'font-size': `${this.lookupTableValueFontSize}px`,
          'font-weight': this.fontWeight,
          fill: function(d) { return d.color; },
          'fill-opacity': this.overlayTextFillOpacity,
          text: `0 ${this.lookupTableValueUnit}`,
          transform: lookupTransform
        });
      }

      if (this.changeRateValueEnabled) {
        let yOffset = this.fontSize/4 + this.changeRateValueFontSize + this.changeRateValueYOffset;

        if (this.lookupTableValueEnabled) {
          yOffset += this.lookupTableValueFontSize + this.lookupTableValueYOffset;
        }

        let rateTransform = `translate(0, ${yOffset})`;

        this.applyAttributes(this.changeRateValueBehindText, {
          datum: { color: this.backFontColor === null ? this.fillColor : this.backFontColor },
          'text-anchor': 'middle',
          'font-family': this.fontFamily,
          'font-size': `${this.changeRateValueFontSize}px`,
          'font-weight': this.fontWeight,
          fill: function(d) { return d.color; },
          text: `0 ${this.changeRateValueUnit}`,
          transform: rateTransform
        });

        this.applyAttributes(this.changeRateValueOverlayText, {
          datum: { color: this.frontFontColor === null ? "#fff" : this.frontFontColor },
          'text-anchor': 'middle',
          'font-family': this.fontFamily,
          'font-size': `${this.changeRateValueFontSize}px`,
          'font-weight': this.fontWeight,
          fill: function(d) { return d.color; },
          'fill-opacity': this.overlayTextFillOpacity,
          text: `0 ${this.changeRateValueUnit}`,
          transform: rateTransform
        });
      }
    }

    applyWaveHorizontalAttributes() {
      this.clipDef = `M0 0 Q${this.waveWidth/2} ${this.amplitude}, ${this.waveWidth} 0 T${2*this.waveWidth} 0`;
      var minRequiredClipWidth = this.width*2 + 2*this.waveWidth + this.borderWidth/2;
      this.clipWidth = 2*this.waveWidth;

      while ( this.clipWidth < minRequiredClipWidth ) {
        this.clipWidth += this.waveWidth;
        this.clipDef += ` T${this.clipWidth} 0`;
        this.clipWidth += this.waveWidth;
        this.clipDef += ` T${this.clipWidth} 0`;
      }
      this.clipDefArray = [this.clipDef, `L${this.clipWidth}`, `${this.height}`, "L0", `${this.height}`, "Z"];
      this.clipDef = this.clipDefArray.join(" ");

      this.applyAttributes(this.waveHorizontal, {
        d: this.clipDef
      });
    }

    applySupportLabelAttributes() {
      this.applyAttributes(this.supportLabelBg, {
        datum: { color: this.fillColor },
        width: 50,
        height: 50,
        rx: this.innerCornerRadius,
        ry: this.innerCornerRadius,
        fill: '#fafafa',
        'fill-opacity': this.supportLabelBackgroundOpacity,
        stroke: function(d) { return d.color; },
        'stroke-width': this.supportLabelBackgroundBorderWidth
      });

      this.applyAttributes(this.supportLabel, {
        'text-anchor': 'middle',
        'font-family': this.supportLabelFontFamily,
        'font-size': `${this.supportLabelFontSize}px`,
        fill: this.supportLabelFontColor,
        'font-weight': this.supportLabelFontWeight,
        text: `${this.supportLabelText}`
      });

      this.applyAttributes(this.topSupportLabel, {
        'text-anchor': 'middle',
        'font-family': this.supportLabelFontFamily,
        'font-size': `${this.topSupportLabelFontSize}px`,
        fill: this.supportLabelFontColor,
        'font-weight': this.supportLabelFontWeight,
        text: `${this.topSupportLabelText}`
      });
    }

    tweenWaveHorizontal () {
      let that = this;
      let startHeight = (this.tankHeight - this.innerHeight)/2 - this.amplitude/2;
      let transformStart = `translate(-${this.width + 2*this.waveWidth}, ${startHeight})`;
      let transformEnd = `translate(-${this.width}, ${startHeight})`;

      this.waveHorizontal.attr('transform', transformStart);

      animate();

      function animate() {
        that.waveHorizontal
          .transition()
          .duration(that.horizontalWaveDuration)
          .ease(d3.easeLinear)
          .attrTween("transform", function(d) {
            return d3.interpolateString(transformStart, transformEnd);
          }).on("end", function (d) {
          animate();
        });
      }
    }

    animateFromZero () {
      this.waveClip
        .datum({ transform: `translate(0, ${this.gaugeScale(this.fillMinValue) + this.amplitude})`})
        .attr('transform', function(d) { return d.transform; });
      this.animateNewHeight(this.fillValue);
    }

    animateNewHeight (val) {
      let that = this;
      if ( typeof val !== "undefined" ) {
        this.newHeight = this.gaugeScale(val);
        this.fillValue = val;
      }

      this.tweenWaveVertical();
      this.tweenElements();
    }

    tweenWaveVertical() {
      let endTransform = `translate(0, ${this.newHeight})`;

      return this.waveClip
        .transition()
        .delay(this.delay)
        .duration(this.transitionDuration)
        .ease(this.ease)
        .attrTween("transform", function(d) {
          let interpolator = d3.interpolateString(d.transform, endTransform);

          return function(t) {
            d.transform = interpolator(t);
            return d.transform;
          };
        });
    }

    calculateColor () {
      this.fillAnimationColor = this.fillColor === null ? this.defaultFillColor : this.fillColor;
      this.backFontAnimationColor = this.backFontColor === null ? this.fillColor : this.backFontColor;
      this.backArrowAnimationColor = this.backArrowColor === null ? this.fillColor : this.backArrowColor;
    }

    tweenElements () {
      this.calculateColor();
      this.colorTransition(this.waterFill, "fill", this.fillAnimationColor);
      this.colorTransition(this.supportLabelBg, 'stroke', this.fillAnimationColor);
      this.tweenText();

      if ( this.arrow === true ) {
        this.colorTransition(this.behindArrow, "fill", this.backArrowAnimationColor);
        this.colorTransition(this.overlayArrow, "fill", this.frontArrowColor);
      }

      if (this.tankType === 'round') {
        this.colorTransition(this.neckFill, 'fill', this.fillAnimationColor);
      }
    }

    colorTransition(selection, attribute, targetColor) {
      selection
        .transition()
        .delay(this.delay)
        .duration(this.transitionDuration)
        .ease(this.ease)
        .attrTween(attribute, function(d) {
          let interpolator = d3.interpolateRgb(d.color, targetColor);

          return function(t) {
            d.color = interpolator(t);
            return d.color;
          };
        });
    }

    textFormatter(val) {
      if (this.fillUnit) {
        return `${(Number(Math.round(parseFloat(val) + 'e' + this.decimal) + 'e-' + this.decimal)).toFixed(this.decimal)} ${this.fillUnit}`;
      }
      return `${(Number(Math.round(parseFloat(val) + 'e' + this.decimal) + 'e-' + this.decimal)).toFixed(this.decimal)}`;
    }

    lookupTextFormatter(val) {
      if (this.lookupTableValueUnit) {
        return `${Number(Math.round(parseFloat(val) + 'e' + this.lookupTableValueDecimal) + 'e-' + this.lookupTableValueDecimal).toFixed(this.lookupTableValueDecimal)} ${this.lookupTableValueUnit}`;
      }
      return `${Number(Math.round(parseFloat(val) + 'e' + this.lookupTableValueDecimal) + 'e-' + this.lookupTableValueDecimal).toFixed(this.lookupTableValueDecimal)}`;
    }

    changeRateValueTextFormatter(val) {
      if (this.changeRateValueUnit) {
        return `${Number(Math.round(parseFloat(val) + 'e' + this.changeRateValueDecimal) + 'e-' + this.changeRateValueDecimal).toFixed(this.changeRateValueDecimal)} ${this.changeRateValueUnit}`;
      }
      return `${Number(Math.round(parseFloat(val) + 'e' + this.changeRateValueDecimal) + 'e-' + this.changeRateValueDecimal).toFixed(this.changeRateValueDecimal)}`;
    }

    tweenText() {
      let that = this;

      this.behindText
        .transition()
        .delay(this.delay)
        .ease(this.ease)
        .duration(this.transitionDuration)
        .tween("text", function(d) {
          let node = this;
          let interpolate = d3.interpolate(that.textFormatter(node.textContent), that.textFormatter(that.fillValue));

          return function(t) {
            node.textContent = that.textFormatter(interpolate(t));
          };
        })
        .attrTween("fill", function(d) {
          let interpolator = d3.interpolateRgb(d.color, that.backFontAnimationColor);

          return function(t) {
            d.color = interpolator(t);
            return d.color;
          };
        });

      this.overlayText
        .transition()
        .delay(this.delay)
        .ease(this.ease)
        .duration(this.transitionDuration)
        .tween("text", function(d) {
          let node = this;
          let interpolate = d3.interpolate(that.textFormatter(node.textContent), that.textFormatter(that.fillValue));
          return function(t) {
            if (that.arrow === true) {
              that.updateArrowPosition();
            }
            node.textContent = that.textFormatter(interpolate(t));
          };
        })
        .attrTween("fill", function(d) {
          let interpolator = d3.interpolateRgb(d.color, that.frontFontColor);

          return function(t) {
            d.color = interpolator(t);
            return d.color;
          };
        })
        .on('end', function() {
          if (that.arrow === true) {
            that.updateArrowPosition();
          }
        });

      if (this.lookupTableValueEnabled) {
        this.lookupTableValueBehindText
          .transition()
          .delay(this.delay)
          .ease(this.ease)
          .duration(this.transitionDuration)
          .tween("text", function(d) {
            let node = this;
            let interpolate = d3.interpolate(that.lookupTextFormatter(node.textContent), that.lookupTextFormatter(that.lookupTableValue));

            return function(t) {
              node.textContent = that.lookupTextFormatter(interpolate(t));
            };
          })
          .attrTween("fill", function(d) {
            let interpolator = d3.interpolateRgb(d.color, that.backFontAnimationColor);

            return function(t) {
              d.color = interpolator(t);
              return d.color;
            };
          });

        this.lookupTableValueOverlayText
          .transition()
          .delay(this.delay)
          .ease(this.ease)
          .duration(this.transitionDuration)
          .tween("text", function(d) {
            let node = this;
            let interpolate = d3.interpolate(that.lookupTextFormatter(node.textContent), that.lookupTextFormatter(that.lookupTableValue));
            return function(t) {
              node.textContent = that.lookupTextFormatter(interpolate(t));
            };
          })
          .attrTween("fill", function(d) {
            let interpolator = d3.interpolateRgb(d.color, that.frontFontColor);

            return function(t) {
              d.color = interpolator(t);
              return d.color;
            };
          });
      }

      if (this.changeRateValueEnabled) {
        this.changeRateValueBehindText
          .transition()
          .delay(this.delay)
          .ease(this.ease)
          .duration(this.transitionDuration)
          .tween("text", function(d) {
            let node = this;
            let interpolate = d3.interpolate(that.changeRateValueTextFormatter(node.textContent), that.changeRateValueTextFormatter(that.changeRateValue));

            return function(t) {
              node.textContent = that.changeRateValueTextFormatter(interpolate(t));
            };
          })
          .attrTween("fill", function(d) {
            let interpolator = d3.interpolateRgb(d.color, that.backFontAnimationColor);

            return function(t) {
              d.color = interpolator(t);
              return d.color;
            };
          });

        this.changeRateValueOverlayText
          .transition()
          .delay(this.delay)
          .ease(this.ease)
          .duration(this.transitionDuration)
          .tween("text", function(d) {
            let node = this;
            let interpolate = d3.interpolate(that.changeRateValueTextFormatter(node.textContent), that.changeRateValueTextFormatter(that.changeRateValue));
            return function(t) {
              node.textContent = that.changeRateValueTextFormatter(interpolate(t));
            };
          })
          .attrTween("fill", function(d) {
            let interpolator = d3.interpolateRgb(d.color, that.frontFontColor);

            return function(t) {
              d.color = interpolator(t);
              return d.color;
            };
          });
      }
    }

    updateArrowPosition () {
      let {xOffset, yOffset} = this.calculateArrowPosition();
      this.behindArrow.attr('x', xOffset).attr('y', yOffset);
      this.overlayArrow.attr('x', xOffset).attr('y', yOffset);
    }

    calculateArrowPosition () {
      let xOffset, yOffset;

      if (this.changeRateValueArrowEnabled && this.changeRateValueEnabled) {
        xOffset = this.changeRateValueOverlayText.node().getBBox().width/2 + this.overlayArrow.node().getBBox().width/2 + this.arrowXOffset;
        yOffset = this.fontSize/4 + this.changeRateValueFontSize + this.changeRateValueYOffset - 1;

        if (this.lookupTableValueEnabled) {
          yOffset += this.lookupTableValueFontSize + this.lookupTableValueYOffset;
        }
      } else {
        xOffset = this.overlayText.node().getBBox().width/2 + this.overlayArrow.node().getBBox().width + this.arrowXOffset;
        yOffset = this.overlayArrow.node().getBBox().height/4 + this.arrowYOffset;
      }

      return {xOffset: xOffset, yOffset: yOffset};
    }

    repositionElements () {
      this.repositionMarker();
      this.setSupportLabelText(this.supportLabelText);
    }

    // calculate the needed transformation values for positioning the markers
    repositionMarker () {
      let topMarkerLabelTrans = `translate(${this.innerWidth/2 + this.markerLabelXOffset - this.markerFontSize/4}, -${this.innerHeight/2 - this.markerFontSize + this.markerLabelYOffset})`;
      let bottomMarkerLabelTrans = `translate(${this.innerWidth/2 + this.markerLabelXOffset - this.markerFontSize/4}, ${this.innerHeight/2 - this.markerFontSize/4 + this.markerLabelYOffset})`;

      this.topMarkerLabel.attr('transform', topMarkerLabelTrans);
      this.bottomMarkerLabel.attr('transform', bottomMarkerLabelTrans);

      if (this.tankType === 'round') {
        let markerBarGroupTrans = `translate(${this.innerWidth/2 + this.markerLength + this.markerBarXOffset}, 0)`;

        this.markerBarGroup.attr('transform', markerBarGroupTrans);
      } else if (this.tankType === 'tower') {
        let markerBarGroupTrans = `translate(${this.innerWidth/2}, 0)`;

        this.markerBarGroup.attr('transform', markerBarGroupTrans);
      }
    }

    repositionSupportLabelGroup() {
      this.repositionSupportLabelBg();
      this.repositionSupportLabel();

      this.supportLabelGroup
        .attr('transform', `translate(0, ${this.height/2 - this.borderWidth - this.supportLabelBgHeight/2})`);
    }

    repositionSupportLabelBg () {
      let paddingForAesthetic = 1.6*this.supportLabelPadding;
      let {width, height} = this.getSupportLabelDimensions();
      let requiredWidth = width + 2*this.supportLabelPadding + paddingForAesthetic;
      let requiredHeight = height + 2*this.supportLabelPadding;
      this.supportLabelBgWidth = requiredWidth;
      this.supportLabelBgHeight = requiredHeight;

      this.supportLabelBg
        .attr('width', this.supportLabelBgWidth)
        .attr('height', this.supportLabelBgHeight)
        .attr('transform', `translate(-${this.supportLabelBgWidth/2}, -${this.supportLabelBgHeight/2})`);
    }

    repositionSupportLabel () {
      if ( this.dualSupportLabel === true ) {
        this.topSupportLabelTrans = `translate(0, ${this.supportLabelYOffset + this.topSupportLabelYOffset})`;
        this.supportLabelTrans = `translate(0, ${this.supportLabelFontSize + this.supportLabelYOffset})`;
      } else if ( this.dualSupportLabel === false ) {
        this.supportLabelTrans = `translate(0, ${this.supportLabelFontSize/2 + this.supportLabelYOffset})`;
      }
      this.topSupportLabel.attr('transform', this.topSupportLabelTrans);
      this.supportLabel.attr('transform', this.supportLabelTrans);
    }

    applyAttributes(selection, datum = {}) {
      let properties = Object.getOwnPropertyNames(datum);
      properties.forEach((p) => {
        if (p === 'datum') {
          return selection.datum( datum[p] );
        } else if (p === 'text') {
          return selection.text( datum[p] );
        } else if (p === 'style') {
          return selection.style( datum[p] );
        } else {
          return selection.attr( p, datum[p] );
        }
      });
    }

    getSupportLabelDimensions () {
      let width, height;
      if ( this.dualSupportLabel === true ) {
        width = this.getMaxWidth(this.supportLabel, this.topSupportLabel);
        height = this.supportLabelFontSize - this.supportLabelYOffset + this.topSupportLabelFontSize - this.topSupportLabelYOffset;
      } else if ( this.dualSupportLabel === false ) {
        width = this.supportLabel.node().getBBox().width;
        height = this.supportLabelFontSize - this.supportLabelYOffset;
      }

      return {width: width, height: height};
    }

    getHeight(selection) {
      return selection.node().getBBox().height;
    }

    getMaxWidth (first, second) {
      if (typeof second === 'object') {
        return Math.max(first.node().getBBox().width, second.node().getBBox().width);
      }
      return first.node().getBBox().width;
    }

    getXCoordOfEllipse(y) {
      return Math.sqrt( Math.pow(this.tankRx, 2)*(1 - ( Math.pow(y, 2)/Math.pow(this.tankRy, 2) )) );
    }

    getYCoordOfEllipse(x) {
      return Math.sqrt( Math.pow(this.tankRy, 2)*(1 - ( Math.pow(x, 2)/Math.pow(this.tankRx, 2) )) );
    }

    slopeOfLineTangentToEllipse(x, y) {
      return -x*Math.pow(this.tankRy,2)/(y*Math.pow(this.tankRx,2));
    }

    setDecimal (val) {
      this.decimal = val;
      this.tweenText();
    }

    updateHeight (val) {
      this.animateNewHeight(val);
    }

    updateLookupTableValue (val) {
      this.lookupTableValue = val;
    }

    updateChangeRateValue (val) {
      this.changeRateValue = val;
    }

    setMarkerText (top, bottom) {
      if ( this.marker === true ) {
        this.topMarkerLabel.text(top);
        this.bottomMarkerLabel.text(bottom);
      } else {
        console.log("markers are not enabled.");
      }
      this.repositionMarker();
    }

    setSupportLabelText (...args) {
      if ( this.enableSupportLabel === true ) {
        if ( args.length === 1 ) {
          this.dualSupportLabel = false;
          this.topSupportLabel.attr('fill-opacity', 0);
          this.supportLabel.text(args[0]);
        } else if ( args.length === 2 ) {
          this.dualSupportLabel = true;
          this.topSupportLabel.attr('fill-opacity', 1);
          this.supportLabel.text(args[1]);
          this.topSupportLabel.text(args[0]);
        }
      }

      //resize and reposition support label elements
      this.repositionSupportLabelGroup();
    }

    updateFillColor (options) {
      if ( typeof options === "object" ) {
        if ( "fillColor" in options ) {
          this.fillColor = options.fillColor;
        }
        if ( "overlayTextFillOpacity" in options ) {
          this.overlayTextFillOpacity = options.overlayTextFillOpacity;
        }
        if ( "topFillColor" in options ) {
          this.topFillColor = options.topFillColor;
        }
        if ( "topFillBackFontColor" in options ) {
          this.topFillBackFontColor = options.topFillBackFontColor;
        }
        if ( "bottomFillColor" in options ) {
          this.bottomFillColor = options.bottomFillColor;
        }
        if ( "bottomFillBackFontColor" in options ) {
          this.bottomFillBackFontColor = options.bottomFillBackFontColor;
        }
        if ( "backFontColor" in options ) {
          this.backFontColor = options.backFontColor;
        }
        if ( "frontFontColor" in options ) {
          this.frontFontColor = options.frontFontColor;
        }
        if ( "topFillBackArrowColor" in options ) {
          this.topFillBackArrowColor = options.topFillBackArrowColor;
        }
        if ( "bottomFillBackArrowColor" in options ) {
          this.bottomFillBackArrowColor = options.bottomFillBackArrowColor;
        }
        if ( "frontArrowColor" in options ) {
          this.frontArrowColor = options.frontArrowColor;
        }
        if ( "backArrowColor" in options ) {
          this.backArrowColor = options.backArrowColor;
        }
        this.tweenElements();
      }
    }

    updateColor (color) {
      this.fillColor = color;
      this.backFontColor = color;
      this.backArrowColor = color;
      this.tweenElements();
    }

    updateArrow (options) {
      if ( "destroy" in options ) {
        if ( options.destroy === true ) {
          this.removeArrow();
        }
      } else if ( "enable" in options ) {
        this.arrow = true;
        this.addArrow();
      }
      if ( typeof this.behindArrow !== "undefined" && typeof this.overlayArrow !== "undefined" ) {
        if ( "topFillBackArrowColor" in options ) {
          this.topFillBackArrowColor = options.topFillBackArrowColor;
        }
        if ( "bottomFillBackArrowColor" in options ) {
          this.bottomFillBackArrowColor = options.bottomFillBackArrowColor;
        }
        if ( "frontArrowColor" in options ) {
          this.frontArrowColor = options.frontArrowColor;
        }
        if ( "backArrowColor" in options ) {
          this.backArrowColor = options.backArrowColor;
        }
        if ( "direction" in options ) {
          let direction = options.direction;
          if ( direction === "up" ) {
            this.arrowName = this.upArrowName;
          } else if ( direction === "down" ) {
            this.arrowName = this.downArrowName;
          } else if ( direction === "none" ) {
            this.arrowName = this.noArrowName;
          }
          this.behindArrow.text(this.arrowName);
          this.overlayArrow.text(this.arrowName);
        }
        if ( "changeRateValueArrowEnabled" in options ) {
          this.changeRateValueArrowEnabled = options.changeRateValueArrowEnabled;
        }

        this.tweenElements();
        this.updateArrowPosition();
      }
    }

    addArrow() {
      this.behindArrow.attr('fill-opacity', 1);
      this.overlayArrow.attr('fill-opacity', 1);
    }

    removeArrow () {
      this.behindArrow.attr('fill-opacity', 0);
      this.overlayArrow.attr('fill-opacity', 0);
      this.arrow = false;
    }

    redraw() {
      this.destroy();
      this.init();
    }

    destroy() {
      this.tankWidth = null;
      this.tankHeight = null;
      this.viewPortWidth = null;
      this.viewPortHeight = null;
      this.topMarkerText = null;
      this.bottomMarkerText = null;
      this.svgContainer.remove();
    }

    click(callback) {
      if ( typeof callback !== "function" ) {
        throw new Error("argument must be a function");
      }
      this.svgContainer.on("click", callback);
    }

    setBisector() {
      this.bisector = d3.bisector(function(d) { return d.yCoord; }).left;
    }

    transitionMarker(marker, targetWidth, targetX1) {
      marker
        .transition()
        .duration(200)
        .ease(d3.easeLinear)
        .attrTween('stroke-width', function(d) {
          let interpolator = d3.interpolateNumber(d.strokeWidth, targetWidth);

          return function(t) {
            d.strokeWidth = interpolator(t);
            return d.strokeWidth;
          };
        })
        .attrTween('x1', function(d) {
          let interpolator = d3.interpolateNumber(d.x1, targetX1);

          return function(t) {
            d.x1 = interpolator(t);
            return d.x1;
          };
        });
    }

    hover() {
      d3.select(this.svgContainer.node().parentNode).on('mouseleave', () => {
        this.thresholdMarkers.forEach( (marker, i) => {
          this.transitionMarker(marker, this.markerWidth, -this.markerLength);
          this.thresholdTooltips[i].style('display', 'none');
        });
      });

      d3.select(this.svgContainer.node().parentNode).on('mousemove', () => {
        let yCoord = d3.mouse(this.markerBarGroup.node())[1];
        let locationIndex = this.bisector(this.thresholdMarkerPositions, yCoord);

        if (locationIndex >= 0) {
          this.thresholdMarkers.forEach( (marker, i) => {
            if ( i === locationIndex) {
              this.transitionMarker(marker, this.markerWidth+3, -(this.markerLength+3));
              this.thresholdTooltips[i].style('display', 'initial');
            } else {
              this.transitionMarker(marker, this.markerWidth, -this.markerLength);
              this.thresholdTooltips[i].style('display', 'none');
            }
          });
        } else {
          this.transitionMarker(this.thresholdMarkers[0], this.markerWidth+3, -(this.markerLength+3));
          this.thresholdTooltips[0].style('display', 'initial');
        }
      });
    }

    // utility functions
    uniqId() {
      // Convert it to base 36 (numbers + letters), and grab the first 9 characters
      // after the decimal.
      return "clipPath" + Math.random().toString(36).substr(2, 9);
    }
    getUniqUrl(id) {
      return `url(${this.url}#${id})`;
    }

    insertFirstBeforeSecond(container, first, second) {
      return container.insert(
        function() { return first.node(); },
        function() { return second.node(); }
      );
    }

    insertFirstAfterSecond(container, first, second) {
      container.insert(
        function() { return first.node(); },
        function() { return second.node(); }
      );

      return container.insert(
        function() { return second.node(); },
        function() { return first.node(); }
      );
    }

    appendSecondElementToFirst(first, ...args) {
      args.forEach((arg) => first.append( () => arg.node() ) );  // for each second argument, return a function: first.append( function(arg) { arg.node() });
    }

  } // end of class

})(jQuery);

let thresholds = [
  {
    name: 'Alarm High',
    value: 90,
    type: 'High',
    alarm: true
  },
  {
    name: 'Pump On',
    value: 55,
    type: 'High',
    alarm: false
  },
  {
    name: 'Pump On',
    value: 40,
    type: 'Low',
    alarm: false
  },
  {
    name: 'Alarm Low',
    value: 10,
    type: 'Low',
    alarm: true
  }
];

let options = {
  tankType: 'tower',
  fillValue: 55,
  fillUnit: "ft",
  supportLabelPadding: 5,
  frontFontColor: "#003B42",
  thresholds: thresholds,
  lookupTableValue: 1700,
  lookupTableValueUnit: 'gal',
  lookupTableValueDecimal: 1,
  changeRateValueDecimal: 3,
  changeRateValueArrowEnabled: true,
  changeRateValue: 0.3,
  changeRateValueUnit: 'gal/min'
}

let tank = $('.wrapper').analogTank(options);

$(".wrapper").resizable({
  stop: function( event, ui ) {
    tank.redraw();
  }
});

let that = this;

let randomColor = ["#C62828", "#BA68C8", "#1976D2", "#FFB74D", "#607D8B"];
function getRandomColor() {
  return randomColor[Math.floor(Math.random() * 5)];
}
function getNow() {
  return Date().slice(16, 24);
}

function getRandom() {
  return Math.floor(Math.random() * 100);
}
tank.click(function () {
  var randomVal = getRandom();
  tank.updateHeight(randomVal);
});

function setOneText() {
  tank.setSupportLabelText(getNow());
}
function setTwoText() {
  tank.setSupportLabelText(getNow(), "bottom label");
}
function fillColor() {
  tank.updateColor(getRandomColor());
}
function backFontColor() {
  tank.updateFillColor({ backFontColor: getRandomColor() });
}
function frontFontColor() {
  tank.updateFillColor({ frontFontColor: getRandomColor() });
}
function topFillBackFontColor() {
  tank.updateFillColor({ topFillBackFontColor: getRandomColor() });
}
function bottomFillBackFontColor() {
  tank.updateFillColor({ bottomFillBackFontColor: getRandomColor() });
}
function topFillColor() {
  tank.updateFillColor({ topFillColor: getRandomColor() });
}
function bottomFillColor() {
  tank.updateFillColor({ bottomFillColor: getRandomColor() });
}

function shrink() {
  document.getElementsByClassName('wrapper')[0].setAttribute("style", "width:200px;height:200px;");
  tank.redraw();
}
function enlarge() {
  document.getElementsByClassName('wrapper')[0].setAttribute("style", "width:400px;height:400px;");
  tank.redraw();
}
function high() {
  tank.updateHeight(90);
}
function mid() {
  tank.updateHeight(55);
}
function low() {
  tank.updateHeight(0);
}
function addArrow() {
  tank.updateArrow({ enable: true });
}
function removeArrow() {
  tank.updateArrow({ destroy: true });
}
function upArrow() {
  tank.updateArrow({ direction: "up" });
}
function downArrow() {
  tank.updateArrow({ direction: "down" });
}
function defaultArrow() {
  tank.updateArrow({ direction: "none" });
}
function topFillArrowColor() {
  tank.updateArrow({ topFillBackArrowColor: getRandomColor() });
}
function bottomFillBackArrowColor() {
  tank.updateArrow({ bottomFillBackArrowColor: getRandomColor() });
}
function frontArrowColor() {
  tank.updateArrow({ frontArrowColor: getRandomColor() });
}
function backArrowColor() {
  tank.updateArrow({ backArrowColor: getRandomColor() });
}
function setDecimalZero() {
  tank.setDecimal(0);
}
function setDecimalOne() {
  tank.setDecimal(1);
}
function setDecimalTwo() {
  tank.setDecimal(2);
}
function tower() {
  tank.tankType = 'tower';
  delete tank.topMarkerFontColor;
  delete tank.bottomMarkerFontColor;
  tank.redraw();
}
function round() {
  tank.tankType = 'round';
  tank.topMarkerFontColor = "#fafafa";
  tank.bottomMarkerFontColor = "#fafafa";
  tank.redraw();
}
function destroy() {
  tank.destroy();
}
function updateLookupTableValue() {
  tank.updateLookupTableValue(parseInt(Math.random()*1000))
}
