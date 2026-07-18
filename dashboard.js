// Plot dimensions for the box plot panel.
const box_plot_width = 900, box_plot_height = 600, box_plot_margin = {top: 56, right: 56, bottom: 80, left: 80};
// Combined lasso interaction, scatter selection, and box plot rendering.
function lasso_and_plot(scatterSvg, x, y, colorScale, colorDomain, box_plot_width, box_plot_height, box_plot_margin) {
	let lasso = false;
	let lasso_data = [];
	let indices = [];
	let highlighted_data = [];

	let lasso_selection = scatterSvg.select('.lasso-selection');
	if (lasso_selection.empty()) {
		lasso_selection = scatterSvg.append('g').attr('class', 'lasso-selection');
	}

	function scatter_select() {
		if (!scatterSvg) return;
		scatterSvg.selectAll('circle')
			.attr('stroke', (d, i) => indices.includes(i) ? '#222' : '#fff')
			.attr('stroke-width', (d, i) => indices.includes(i) ? 3 : 1.2)
			.attr('opacity', (d, i) => indices.length === 0 || indices.includes(i) ? 0.92 : 0.25)
			.attr('r', (d, i) => indices.includes(i) ? 8 : 6);
	}

	function update_selection() {
		const selected_info = document.getElementById('selection-info');
		if (!selected_info) return;
		if (indices.length === 0) {
			selected_info.textContent = 'No points selected.';
		} else {
			selected_info.textContent = indices.length + ' point(s) selected.';
		}
	}

	function set_box_plot(colorScaleParam) {
		d3.select('#box-plot').selectAll('svg').remove();
		if (!currentData.length || !attributes.quantitative.length) return;
		const boxAttr = document.getElementById('boxplot-select').value;
		const colorAttr = document.getElementById('color-select').value;
		if (!boxAttr || !colorAttr) return;

		// Use only selected points when available; otherwise use all points.
		let data = highlighted_data.length ? highlighted_data : currentData;
		// Group values by the selected color attribute.
		const colorDomain = Array.from(new Set(currentData.map(d => d[colorAttr])));
		const groups = colorDomain.map(g => ({
			key: g,
			values: data.filter(d => d[colorAttr] === g).map(d => +d[boxAttr]).filter(isNumeric)
		}));

		// Build axis scale from the full dataset for consistent comparison.
		const allVals = currentData.map(d => +d[boxAttr]).filter(isNumeric);
		const y = d3.scaleLinear()
			.domain([d3.min(allVals), d3.max(allVals)])
			.nice()
			.range([box_plot_height - box_plot_margin.bottom, box_plot_margin.top]);

		const xBox = d3.scaleBand()
			.domain(colorDomain)
			.range([box_plot_margin.left, box_plot_width - box_plot_margin.right])
			.padding(0.18);

		let boxplotSvg = d3.select('#box-plot')
			.append('svg')
			.attr('width', box_plot_width)
			.attr('height', box_plot_height);

		// Render the y-axis.
		boxplotSvg.append('g')
			.attr('transform', `translate(${box_plot_margin.left},0)`)
			.call(d3.axisLeft(y));
		// Render the x-axis.
		boxplotSvg.append('g')
			.attr('transform', `translate(0,${box_plot_height - box_plot_margin.bottom})`)
			.call(d3.axisBottom(xBox));

		// Render axis labels.
		boxplotSvg.append('text')
			.attr('x', box_plot_width / 2)
			.attr('y', box_plot_height - 12)
			.attr('text-anchor', 'middle')
			.attr('font-size', '1.1em')
			.attr('fill', '#333')
			.text(colorAttr);
		boxplotSvg.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -box_plot_height / 2)
			.attr('y', 18)
			.attr('text-anchor', 'middle')
			.attr('font-size', '1.1em')
			.attr('fill', '#333')
			.text(boxAttr);

		// Render one grouped box plot per color category.
		const boxGroup = boxplotSvg.append('g').attr('class', 'boxplot-groups');
		let delay = 0;
		groups.forEach((g, i) => {
			const vals = g.values;
			const xPos = xBox(g.key) + xBox.bandwidth() / 2;
			   const color = colorScaleParam ? colorScaleParam(g.key) : d3.schemeSet2[i % 8];
			if (vals.length >= 5) {
				// Compute quartiles, whiskers, and outliers for this group.
				vals.sort(d3.ascending);
				const q1 = d3.quantile(vals, 0.25);
				const median = d3.quantile(vals, 0.5);
				const q3 = d3.quantile(vals, 0.75);
				const iqr = q3 - q1;
				const min = d3.max([d3.min(vals), q1 - 1.5 * iqr]);
				const max = d3.min([d3.max(vals), q3 + 1.5 * iqr]);
				const outliers = vals.filter(v => v < min || v > max);

				// Stagger transitions so each group appears progressively.
				const gElem = boxGroup.append('g').attr('class', 'box-group').attr('data-group', g.key);
				// Render whiskers.
				gElem.append('line')
					.attr('x1', xPos).attr('x2', xPos)
					.attr('y1', y(min)).attr('y2', y(max))
					.attr('stroke', color).attr('stroke-width', 3)
					.attr('opacity', 0)
					.transition().delay(delay).duration(350).attr('opacity', 1);
				// Render the interquartile box.
				gElem.append('rect')
					.attr('x', xPos - xBox.bandwidth() / 3)
					.attr('width', xBox.bandwidth() * 2 / 3)
					.attr('y', y(q3))
					.attr('height', y(q1) - y(q3))
					.attr('fill', color)
					.attr('stroke', '#333')
					.attr('stroke-width', 1.2)
					.attr('opacity', 0)
					.transition().delay(delay + 200).duration(350).attr('opacity', 0.85);
				// Render the median line.
				gElem.append('line')
					.attr('x1', xPos - xBox.bandwidth() / 3)
					.attr('x2', xPos + xBox.bandwidth() / 3)
					.attr('y1', y(median)).attr('y2', y(median))
					.attr('stroke', '#222').attr('stroke-width', 2.2)
					.attr('opacity', 0)
					.transition().delay(delay + 400).duration(250).attr('opacity', 1);
				// Render outlier points.
				gElem.selectAll('.outlier')
					.data(outliers)
					.enter()
					.append('circle')
					.attr('class', 'outlier')
					.attr('cx', xPos)
					.attr('cy', d => y(d))
					.attr('r', 4)
					.attr('fill', color)
					.attr('stroke', '#c00')
					.attr('stroke-width', 1.2)
					.attr('opacity', 0)
					.transition().delay(delay + 600).duration(250).attr('opacity', 1);
				// Render the group label.
				gElem.append('text')
					.attr('x', xPos)
					.attr('y', y(q3) - 8)
					.attr('text-anchor', 'middle')
					.attr('font-size', '1em')
					.attr('fill', color)
					.text(g.key);
			} else if (vals.length > 0) {
				// Render jittered points when there are too few values for a box plot.
				const gElem = boxGroup.append('g').attr('class', 'box-group').attr('data-group', g.key);
				gElem.selectAll('.pt')
					.data(vals)
					.enter()
					.append('circle')
					.attr('class', 'pt')
					.attr('cx', () => xPos + (Math.random() - 0.5) * xBox.bandwidth() * 0.5)
					.attr('cy', d => y(d))
					.attr('r', 5)
					.attr('fill', color)
					.attr('stroke', '#333')
					.attr('stroke-width', 1.1)
					.attr('opacity', 0)
					.transition().delay(delay).duration(350).attr('opacity', 0.85);
				gElem.append('text')
					.attr('x', xPos)
					.attr('y', box_plot_height - box_plot_margin.bottom + 18)
					.attr('text-anchor', 'middle')
					.attr('font-size', '1em')
					.attr('fill', color)
					.text(g.key);
			} else {
				// Render a faded label for empty groups.
				const gElem = boxGroup.append('g').attr('class', 'box-group').attr('data-group', g.key);
				gElem.append('text')
					.attr('x', xPos)
					.attr('y', box_plot_height - box_plot_margin.bottom + 18)
					.attr('text-anchor', 'middle')
					.attr('font-size', '1em')
					.attr('fill', '#bbb')
					.text(g.key + ' (empty)');
			}
			delay += 120;
		});
	}

	// Handle lasso interactions for point selection.
	const lassoRect = scatterSvg.select('rect');
	lassoRect.on('mousedown', null).on('mousemove', null).on('mouseup', null).on('click', null);
	let lassoPath = null;
	let lassoLine = d3.line();
	let isDragging = false;

	function onMouseDown(event) {
		if (event.button !== 0) return;
		isDragging = true;
		lasso = true;
		lasso_data = [];
		indices = [];
		highlighted_data = [];
		lasso_selection.selectAll('*').remove();
		lasso_data.push(d3.pointer(event, scatterSvg.node()));
		lassoPath = lasso_selection.append('path')
			.attr('class', 'lasso-path')
			.attr('fill', 'rgba(80,120,255,0.12)')
			.attr('stroke', '#5078ff')
			.attr('stroke-width', 2);
		// Attach move and up listeners so lasso finalizes correctly.
		scatterSvg.on('mousemove.lasso', onMouseMove);
		scatterSvg.on('mouseup.lasso', onMouseUp);
	}

	function onMouseMove(event) {
		if (!isDragging) return;
		lasso_data.push(d3.pointer(event, scatterSvg.node()));
		lassoPath.attr('d', lassoLine(lasso_data) + 'Z');
	}

	function onMouseUp(event) {
		if (!isDragging) return;
		isDragging = false;
		lasso = false;
		// Remove temporary lasso listeners.
		scatterSvg.on('mousemove.lasso', null);
		scatterSvg.on('mouseup.lasso', null);
		// Clear the lasso path after mouse release.
		lasso_selection.selectAll('*').remove();
		if (lasso_data.length < 3) {
			// Clear selection when the interaction is only a click.
			indices = [];
			highlighted_data = [];
			scatter_select();
			update_selection();
			set_box_plot(colorScale);
			return;
		}
		// Compute which points fall inside the lasso polygon.
		const polygon = lasso_data;
		indices = [];
		highlighted_data = [];
		currentData.forEach((d, i) => {
			const px = x(+d[document.getElementById('x-attr-select').value]);
			const py = y(+d[document.getElementById('y-attr-select').value]);
			if (d3.polygonContains(polygon, [px, py])) {
				indices.push(i);
				highlighted_data.push(d);
			}
		});
		scatter_select();
		update_selection();
			   set_box_plot(colorScale);
	}

	function onClick(event) {
		if (!lasso && !isDragging) {
			indices = [];
			highlighted_data = [];
			scatter_select();
			update_selection();
			   set_box_plot(colorScale);
			lasso_selection.selectAll('*').remove();
		}
	}

	lassoRect.on('mousedown', onMouseDown);
	lassoRect.on('click', onClick);

	// Initialize with no selected points.
	indices = [];
	highlighted_data = [];
	scatter_select();
	update_selection();
	set_box_plot();
}
// Scatter plot dimensions.
const scatterWidth = 900, scatterHeight = 600, scatterMargin = {top: 56, right: 56, bottom: 80, left: 80};
let scatterSvg = null;
let colorScale = null;

function drawScatterPlot() {
	// Clear the previous scatter plot before redrawing.
	d3.select('#scatter-plot').selectAll('svg').remove();
	if (!currentData.length || attributes.quantitative.length < 2) return;
	const xAttr = document.getElementById('x-attr-select').value;
	const yAttr = document.getElementById('y-attr-select').value;
	const colorAttr = document.getElementById('color-select').value;
	if (!xAttr || !yAttr || !colorAttr) return;

	// Create the scatter plot SVG container.
	scatterSvg = d3.select('#scatter-plot')
		.append('svg')
		.attr('width', scatterWidth)
		.attr('height', scatterHeight);

	// Build numeric scales for selected x and y attributes.
	const x = d3.scaleLinear()
		.domain(d3.extent(currentData, d => +d[xAttr])).nice()
		.range([scatterMargin.left, scatterWidth - scatterMargin.right]);
	const y = d3.scaleLinear()
		.domain(d3.extent(currentData, d => +d[yAttr])).nice()
		.range([scatterHeight - scatterMargin.bottom, scatterMargin.top]);

	// Build a categorical color scale for the selected grouping attribute.
	const colorDomain = Array.from(new Set(currentData.map(d => d[colorAttr])));
	colorScale = d3.scaleOrdinal()
		.domain(colorDomain)
		.range(d3.schemeSet2.concat(d3.schemeSet1, d3.schemeDark2));

	// Render x and y axes.
	scatterSvg.append('g')
		.attr('transform', `translate(0,${scatterHeight - scatterMargin.bottom})`)
		.call(d3.axisBottom(x));
	scatterSvg.append('g')
		.attr('transform', `translate(${scatterMargin.left},0)`)
		.call(d3.axisLeft(y));

	// Render axis labels.
	scatterSvg.append('text')
		.attr('x', scatterWidth / 2)
		.attr('y', scatterHeight - 12)
		.attr('text-anchor', 'middle')
		.attr('font-size', '1.1em')
		.attr('fill', '#333')
		.text(xAttr);
	scatterSvg.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('x', -scatterHeight / 2)
		.attr('y', 18)
		.attr('text-anchor', 'middle')
		.attr('font-size', '1.1em')
		.attr('fill', '#333')
		.text(yAttr);

	// Add a transparent interaction layer for lasso input.
	scatterSvg.append('rect')
		.attr('x', scatterMargin.left)
		.attr('y', scatterMargin.top)
		.attr('width', scatterWidth - scatterMargin.left - scatterMargin.right)
		.attr('height', scatterHeight - scatterMargin.top - scatterMargin.bottom)
		.attr('fill', 'transparent')
		.attr('pointer-events', 'all')
		.lower();

	// Render scatter points.
	scatterSvg.append('g')
		.attr('class', 'scatter-points')
		.selectAll('circle')
		.data(currentData)
		.join('circle')
		.attr('cx', d => x(+d[xAttr]))
		.attr('cy', d => y(+d[yAttr]))
		.attr('r', 6)
		.attr('fill', d => colorScale(d[colorAttr]))
		.attr('stroke', '#fff')
		.attr('stroke-width', 1.2)
		.attr('opacity', 0.88);


	// Connect scatter interaction with lasso selection and box plot updates.
	lasso_and_plot(scatterSvg, x, y, colorScale, colorDomain, box_plot_width, box_plot_height, box_plot_margin);

	drawColorKey(colorDomain, colorScale, colorAttr);
}

function drawColorKey(domain, scale, attr) {
	const keyDiv = d3.select('#color-key');
	keyDiv.html('');
	if (!domain.length) return;
	keyDiv.append('span')
		.style('font-weight', 'bold')
		.text(attr + ': ');
	const key = keyDiv.append('span');
	domain.forEach(val => {
		key.append('span')
			.style('display', 'inline-block')
			.style('width', '18px')
			.style('height', '18px')
			.style('background', scale(val))
			.style('margin', '0 6px 0 0')
			.style('border-radius', '4px')
			.style('vertical-align', 'middle');
		key.append('span')
			.style('margin-right', '12px')
			.style('vertical-align', 'middle')
			.text(val);
	});
}
// Utility helpers.
function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

function getQuantitativeAndCategoricalAttributes(data, datasetName) {
	if (!data || data.length === 0) return { quantitative: [], categorical: [] };
	const ignoreCols = datasetName === 'Pokemon.csv' ? ['#', 'Name', 'Type 2'] : [];
	const keys = Object.keys(data[0]).filter(k => !ignoreCols.includes(k));
	const quantitative = [], categorical = [];
	keys.forEach(k => {
		// Infer column type from the first 10 rows.
		let isNum = true;
		for (let i = 0; i < Math.min(10, data.length); i++) {
			if (!isNumeric(data[i][k])) {
				isNum = false;
				break;
			}
		}
		if (isNum) quantitative.push(k);
		else categorical.push(k);
	});
	return { quantitative, categorical };
}

// Populate a dropdown with attribute options.
function populateDropdown(selectId, options) {
	const sel = document.getElementById(selectId);
	sel.innerHTML = '';
	options.forEach(opt => {
		const o = document.createElement('option');
		o.value = opt;
		o.textContent = opt;
		sel.appendChild(o);
	});
}

// Shared dataset state.
let currentData = [];
let currentDatasetName = '';
let attributes = { quantitative: [], categorical: [] };

function loadDataset(datasetName) {
	let path = datasetName;
	if (path === 'penguins_cleaned.csv' || path === 'Pokemon.csv') {
		path = 'data/' + path;
	}
	d3.csv(path).then(data => {
		currentData = data;
		currentDatasetName = datasetName;
		attributes = getQuantitativeAndCategoricalAttributes(data, datasetName);
		// Populate controls with valid attributes.
		populateDropdown('x-attr-select', attributes.quantitative);
		populateDropdown('y-attr-select', attributes.quantitative);
		populateDropdown('color-select', attributes.categorical);
		populateDropdown('boxplot-select', attributes.quantitative);
		// Trigger initial plot rendering.
	drawScatterPlot();
	}).catch(err => {
		alert('Failed to load dataset: ' + err);
	});
}

// Wire UI events after the DOM is loaded.
document.addEventListener('DOMContentLoaded', function() {
	// Load the default dataset.
	const datasetSel = document.getElementById('dataset-select');
	loadDataset(datasetSel.value);
	datasetSel.addEventListener('change', function() {
		loadDataset(this.value);
	});
	// Redraw visualizations when any attribute selector changes.
	['x-attr-select', 'y-attr-select', 'color-select', 'boxplot-select'].forEach(id => {
		document.getElementById(id).addEventListener('change', drawScatterPlot);
	});
});
