/*
 * Some comments quoted from WebGL Programming Guide
 * by Matsuda and Lea, 1st edition.
*
 * @author Peter Subacz
 * 
 * using multiple draw calls example: https://webglfundamentals.org/webgl/lessons/webgl-less-code-more-fun.html
 * strats to draw multiple objects to a screen: 
 * 
 * This program allows a user to upload a ply file and draw that file as a polygon mesh to the screen. The mesh
 * 	can then be translated in the x,y, or z direction as well as be rotated around the roll, pitch, and yaw
 * 	axis. 
 * 
 * A breathing animation can be enabled that will displace a polygon about its surface normal. 
 * 
 * Note: this program is extremely computationally heavy with regards to the breathing animation.
 * 
 * features:
 *  Parse a .ply file 
 * 	Translate around the XYZ:
 * 		Press ' X ' or ' x ' Translate your wireframe in the + x
 * 		Press ' C ' or ' c ' Translate your wireframe in the - x
 * 		Press ' y ' or ' y ' Translate your wireframe in the + y
 * 		Press ' U ' or ' u ' Translate your wireframe in the - y
 * 		Press ' Z ' or ' z ' Translate your wireframe in the + z
 * 		Press ' A ' or ' a ' Translate your wireframe in the - z
 * 	Rotate around the Roll,Pitch,Yaw
 * 		Press ' R ' or ' r ' Rotate your wireframe in an + Roll
 * 		Press ' R ' or ' r ' Rotate your wireframe in an + Roll
 * 		Press ' T ' or ' T ' Rotate your wireframe in an - Pitch
 * 		Press ' O ' or ' o ' Rotate your wireframe in an + Pitch
 * 		Press ' K ' or ' k ' Rotate your wireframe in an + Yaw
 * 		Press ' L ' or ' l ' Rotate your wireframe in an - Yaw
 * 	Breathing animation
 * 		Press ' B ' or ' b ' to toggle the breathing (pulsing).
 * 	Draw normal lines
 * 		Press ' D ' or ' d ' to toggle the normal lines.
 * 	Randomize colors
 * 		Press ' E ' or ' e ' to randomize the line colors
 * 	Reset rotations and Translations
 * 		Press ' Q ' or ' q ' to turn off active modes.
 * 		Press ' W ' or ' w ' to reset model to origin.
 */

// global variables
var gl;					//webgl
var program;			//program defined in html
var rotMatrix;			//rotaton matrix
var translateMatrix;	//translation matrix
var canvas;				//
var id;					// animation frame id
//------------------

var points = [];		//points used int the vertex shader
var colors = [];		//colors for each vertex
var polygons = [];		//list of polygons
var key = '';			//key press string
var theta = 0; 			//degrees roll
var beta = 0;			//degrees pitch
var gamma = 0;			//degrees yaw
var disp = 0.01;		//unit displacement
var dx = 0;				//units x translation
var dy = 0;				//units y translation
var dz = 0;				//units z translation
//Pulse
var pulseScale = 2.5;	//pulse scale
var pulseIndex = 0;		//pulse index for animation
var animationDelay = 2000;//sleep delay in ms
//setup perspective items
var perspectiveScale = 0.9;//perspective scaling factor
var zNear = 0.1;		// init zNear for perspective projection
var zFar = 100;			// init zFar for perspective projection
var extents;			// extents used to calculate model stuff
var avgX = 0;			//Average X to center a model
var avgY = 0;			//Average Y to center a model
var avgZ = 0;			//Average Z to center a model
var centerX = 1;		//polygon center x coord
var centerY = 1;		//polygon center y coord
var centerZ = 1;		//polygon center z coord
var normalLineScale = 0.10;
//control bools
var animation = true;	//toggle animation (used when uploading new file)
var drawNormal = true;	//toggle draw normals on centroid of triangles
var pulse = false;		//toggle breathing animation
var rotPosX = false;	//toggle + roll
var rotNegX = false;	//toggle - roll
var rotPosY = false;	//toggle + Pitch
var rotNegY = false;	//toggle - Pitch
var rotPosZ = false;	//toggle + yaw
var rotNegZ = false;	//toggle - yaw
var transPosX = false;	//toggle + translation in x
var transPosY = false;	//toggle - translation in x
var transPosZ = false;	//toggle + translation in y
var transNegX = false;	//toggle - translation in y
var transNegY = false;	//toggle + translation in z
var transNegZ = false;	//toggle - translation in z

function main() {
	update_state_output(); // update the status box with current status
	process_keypress(' '); // show the possible inputs
	window.onkeypress = function (event) { //when a key is pressed, process the input
		process_keypress(event.key)
	}

	// Add the event listener to parse input file
	document.getElementById('ply-file').addEventListener('change', function () {
		var fileReader = new FileReader();
		fileReader.onload = function (e) {
			// reset model to base frame.
			process_keypress('Q');
			process_keypress('W');
			animation = false;	//turn off animation while getting a new file
			extents = [];		//clear extents
			polygons = [];		//clear polygons
			points = [];		//clear points
			colors = [];		//clear colors
			var vertexCoordsList = []; // list of vertex cordinates 
			var polygonIndexList = []; // list of polygon indexs within the vertexCoordsList.
			//parse the file
			[vertexCoordsList, polygonIndexList, extents] = parse_ply_file(vertexCoordsList, polygonIndexList, fileReader.result);
			init();				//init webgl
			polygons = construct_polygon_points(vertexCoordsList, polygonIndexList); //get polygons
			animationDelay *= 1/(polygons.length);	//set animation delay by the number of polygons in list
			animation = true;	//turn animation back on
			render();			//render the file
		}
		fileReader.readAsText(this.files[0]);
	})
}

function init(){
	/*
		Initialize webgl, and set: viewports, cameras, points
	*/
	canvas = document.getElementById('webgl');// Retrieve <canvas> element
	gl = WebGLUtils.setupWebGL(canvas, undefined);	// Get the rendering context for WebGL
	if (!gl) {
		console.log('Failed to get the rendering context for WebGL');
		return;
	}

	// Initialize shaders
	// This function call will create a shader, upload the GLSL source, and compile the shader
	program = initShaders(gl, "vshader", "fshader");
	gl.useProgram(program);		// Setup camera

	// Tell WebGL how to convert from clip space to pixels
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.enable(gl.CULL_FACE);	//enable culling - default backfacing triangles
	gl.enable(gl.DEPTH_TEST);	//enable depth testing
	set_perspective_view();		//set the camera
	set_point_size();			//set the point size
	gl.clearColor(0.0, 0.0, 0.0, 1.0);	// Set clear color		
}

function render(){   
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	if (pulse){	//if pulse is turned on, look up the pulse distance
		if (pulseIndex<polygons[0][6].length-1){
			pulseIndex+=1;
		}else{
			pulseIndex = 0;
		}
	}
	
	// pass in the polygon points
	var vBuffer = gl.createBuffer();		// Create vertex buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STREAM_DRAW);
	//Get the location of the shader's vPosition attribute in the GPU's memory
	var vPosition = gl.getAttribLocation(program, "vPosition");
	gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(vPosition);
	//Turns the attribute on
	var cBuffer = gl.createBuffer();		// Create color buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STREAM_DRAW);
	//Get the location of the shader's vColor attribute in the GPU's memory
	var vColor = gl.getAttribLocation(program, "vColor");
	gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(vColor);//Turns the attribute on

	// We tell WebGL which shader program to execute.
	set_rotation();			// set rotation if active
	set_translation(); 		// set translation if active
	
	rotMatrix = mult(rotateZ(gamma),mult(rotateY(beta),rotateX(theta)));// calculate the new rotation per render
	var modelToCenterTranslation = translate(-avgX, -avgY, -avgZ);		//translate model to (0,0,0)
	var modelTranslation = translate(dx, dy, dz);						//translate model from center
	var modelScale = scalem(0.8,0.8,0.8);								// scale the model by 0.8
	var index = 6; 			// In the points list, every 6 positions are a new polygon
	var i = 0;
	while(i<(points.length)){
		// 0. Get pulse translations
		var pulseTranslationMatrix = translate(polygons[i/6][6][pulseIndex][0],polygons[i/index][6][pulseIndex][1],polygons[i/index][6][pulseIndex][2]);
		// 1. Translate the polygon to the center for the screen,
		// 2.then rotate it around the center axis, 
		translateMatrix = mult(rotMatrix ,mult(modelToCenterTranslation,pulseTranslationMatrix));
		// 3. translate model from center to set point and scale the model
		var ctMatrix = mult(modelScale,mult(modelTranslation,translateMatrix)); // rotate around the axis then translate it.
		var ctMatrixLoc = gl.getUniformLocation(program, "modelMatrix");

		gl.uniformMatrix4fv(ctMatrixLoc, false, flatten(ctMatrix));		// pass to vertex shader.
		gl.drawArrays(gl.LINE_LOOP, i, 4);		//draw line loops
		if(drawNormal){		
			gl.drawArrays(gl.LINES, i+4,2);		//draw normal lines
		}
		i+=6;	//increment the index
		update_state_output()
	}

	if(true){ //draw a red dot at the center of each model 
		var cCenter = vec4(0,0,0,1.0);
		var cColor = vec4(1.0,0.0,0.0,1)	
		var modelTranslation = translate(dx, dy, dz);
		var ctMatrix = mult(modelTranslation,rotMatrix); // rotate around the axis then translate it
		gl.uniformMatrix4fv(ctMatrixLoc, false, flatten(ctMatrix));

		var vBuffer = gl.createBuffer();		// Create vertex buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, flatten(cCenter), gl.STATIC_DRAW);
		//Get the location of the shader's vPosition attribute in the GPU's memory
		var vPosition = gl.getAttribLocation(program, "vPosition");
		gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(vPosition);			//Turns the attribute on
	
		var cBuffer = gl.createBuffer();		// Create color buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, flatten(cColor), gl.STATIC_DRAW);
		//Get the location of the shader's vColor attribute in the GPU's memory
		var vColor = gl.getAttribLocation(program, "vColor");
		gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(vColor);//Turns the attribute on
		gl.drawArrays(gl.POINTS, 0,1);
	}

	if (animation){ //recursive animation 
		id = requestAnimationFrame(render);
	}
	if(animationDelay>50){
		sleep(50);
	}else {
		sleep(100);
	}
}

function sleep( sleepDuration ){
	// apperently JS does not have a sleep utility, becuase its 'not useful' here is one off the internet
	// source: https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
    var now = new Date().getTime();
    while(new Date().getTime() < now + sleepDuration){ /* do nothing */ } 
}

function set_perspective_view(){
	/*
		sets the projection matrix
	
	*/
	// use the extents to grap the average center point
	if (extents.length){
		centerX = (extents[3]+extents[0])/2.0;
		centerY = (extents[4]+extents[1])/2.0;
		centerZ = (extents[5]+extents[2])/2.0;
		var r = 1.1*Math.sqrt(Math.pow(extents[3] - centerX, 2)+ Math.pow(extents[4] - centerY, 2) + Math.pow(extents[5] - centerZ, 2));
	}else{
		r=1;
	}
	// set FOV and aspect ratio
	var fieldOfView = 60;
	var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	var zDisplacement = r / Math.tan(fieldOfView); 

	zNear = zDisplacement - r;
	zFar = zDisplacement + r;
	
	var thisProj = perspective(fieldOfView, aspect, (zNear), zFar*(1+perspectiveScale));

	var projMatrix = gl.getUniformLocation(program, 'projMatrix');
	gl.uniformMatrix4fv(projMatrix, false, flatten(thisProj));

	var eye = vec3(0.0, 0.0, zNear*1.4); 	// position at camera at XYZ
	var at  = vec3(centerX,centerY, centerZ);		// center point of what is being looked at XYZ
	// var at  = vec3(0, 0, 0);		// center point of what is being looked at XYZ
	var up  = vec3(0.0, 1.0, 0.0); // any dirction use 
	var viewMatrix = lookAt(eye, at, up);
	var viewMatrixLoc = gl.getUniformLocation(program, "viewMatrix");
	gl.uniformMatrix4fv(viewMatrixLoc, false, flatten(viewMatrix));
}

function set_point_size(){
	//Specify the vertex size
	var offsetLoc = gl.getUniformLocation(program, "vPointSize");
	gl.uniform1f(offsetLoc, 7.5);
}

function set_rotation(){
	// camera transforms
	if (rotPosX){
		theta += 15;
	}else if (rotNegX){
		theta -= 15;
	}else{
		//do nothing
	}
	if (rotPosY){
		beta += 15;
	}else if (rotNegY){
		beta -= 15;
	}else{
		//do nothing
	}
	if (rotPosZ){
		gamma += 15;
	}else if (rotNegZ){
		gamma -= 15;
	}else{
		//do nothing
	}
	if (theta%360==0){
		theta = 0;
	}
	if (beta%360==0){
		beta = 0;
	}
	if (gamma%360==0){
		gamma = 0;
	}
}

function set_colors(random){
	// set recolor to random colors.
	animation = false;
	colors = [];
	if(random){
		for(i = 0; i<points.length;i++){
			colors.push(vec4(Math.random(),Math.random(),Math.random(),1));
		}
	}else{
		for(i = 0; i<points.length;i++){
			colors.push(vec4(1,1,1,1));
		}
	}
	animation = true;
}

function set_translation(){
	if( transPosX== true){
		dx += disp;
	}else if(transNegX== true){
		dx -= disp;
	}else{
		//do nothing
	}
	if(transPosY == true){
		dy += disp;
	}else if(transNegY == true){
		dy -= disp;
	}else{
		//do nothing
	}
	if(transPosZ == true){
		dz += disp;
	}else if(transNegZ== true){
		dz -= disp;
	}else{
		//do nothing
	}
}

function update_state_output(){
	// update the output box with relevent information
	msg = "";
	if (animation == true){
		msg += " Animation: On<br>";
	}else{
		msg += " Animation: Off<br>";
	}
	if (pulse == true){
		msg += " Breathing: On<br>";
	}else{
		msg += " Breathing: Off<br>";
	}
	if (drawNormal == true){
		msg += " Normals: On<br>";
	}else{
		msg += " Normals: Off<br>";
	}
	msg += "--------Translation-----------<br>";
	if (transPosX){
		msg += " X: "+dx.toFixed(3)+" Status: +<br>";
	}else if(transNegX){
		msg += " X: "+dx.toFixed(3)+" Status: -<br>";
	}else{
		msg += " X: "+dx.toFixed(3)+" Status: <br>";
	}
	if (transPosY){
		msg += " Y: "+dy.toFixed(3)+" Status: <br>";
	}else if(transNegY){
		msg += " Y: "+dy.toFixed(3)+" Status: <br>";
	}else{
		msg += " Y: "+dy.toFixed(3)+" Status: <br>";
	}
	if (transPosZ){
		msg += " Z: "+dz.toFixed(3)+" Status: <br>";
	}else if(transNegZ){
		msg += " Z: "+dz.toFixed(3)+" Status: <br>";
	}else{
		msg += " Z: "+dz.toFixed(3)+" Status: <br>";
	}
	msg += "--------Rotation---------------<br>";
	//rotations
	if (rotPosX){
		msg += " Roll: " + theta.toFixed(0) + " Status: + <br>";
	}else if(rotNegX){
		msg += " Roll: " + theta.toFixed(0) + " Status: - <br>";
	}else{
		msg += " Roll: " + theta.toFixed(0) + " Status: <br>";
	}
	if (rotPosY){
		msg += " Pitch: " + beta.toFixed(0) + " Status: + <br>";
	}else if(rotNegY){
		msg += " Pitch: " + beta.toFixed(0) + " Status: - <br>";
	}else{
		msg += " Pitch: " + beta.toFixed(0) + " Status: <br>";
	}
	if (rotPosZ){
		msg += " Yaw: " + gamma.toFixed(0) + " Status: + <br>";
	}else if(rotNegZ){
		msg += " Yaw: " + gamma.toFixed(0) + " Status: - <br>";
	}else{
		msg += " Yaw: " + gamma.toFixed(0) + " Status: <br>";
	}
	document.getElementById("meshState").innerHTML = msg;
}

function process_keypress(theKey){
	// function to toggle modes,
	var outputMessage = '';

	//on key presses, do change the colors or modes
	switch (theKey) {
		case 'E':
		case 'e':
			set_colors(true);
			break;
		case 'D':
		case 'd':
			// Translate your wireframe in the + x direction.
			if (drawNormal == false){
				drawNormal = true;
			}else{
				drawNormal = false;
			}
			break;

		case 'X':
		case 'x':
			// Translate your wireframe in the + x direction.
			if (transPosX == false){
				transPosX = true;
				transNegX = false;
			}else{
				transPosX = false;
			}
			break;
		case 'C':
		case 'c':
			//Translate your wireframe in the - x direction
			if (transNegX == false){
				transPosX = false;
				transNegX = true;		//turn on
			}else{
				transNegX = false;
			}
			break;

		case 'Y':
		case 'y':
			//Translate your wireframe in the + y direction.
			if (transPosY == false){
				transPosY = true;//turn on
				transNegY = false;//turn off
			}else{
				transPosY = false;
			}
			break;
		case 'U':
		case 'u':
			//Translate your wireframe in the - y direction
			if (transNegY == false){
				transPosY = false;
				transNegY = true;
			}else{
				transNegY = false;
			}
			break;

		case 'Z':
		case 'z':
			//Translate your wireframe in the + z direction.
			if (transPosZ == false){
				transPosZ = true;
				transNegZ = false;
			}else{
				transPosZ = false;
			}

			break;
		case 'A':
		case 'a':
			//Translate your wireframe in the - z direction.
			if (transNegZ == false){
				transPosZ = false;
				transNegZ = true;
			}else{
				transNegZ = false;
			}

			break;

		case 'R':
		case 'r':
			//Rotate your wireframe in an +X-roll about it's CURRENT position.
			if (rotPosX==false){
				rotNegX = false;
				rotPosX = true;
			}else{
				rotPosX = false;
			}
			break;
		case 'T':
		case 't':

			//Rotate your wireframe in an -X-roll about it's CURRENT position.
			if (rotNegX == false){
				rotNegX = true;
				rotPosX = false;
			}else{
				rotNegX = false;
			}
			break;
		
		case 'O':
		case 'o':
			//Rotate your wireframe in an +Y-roll about it's CURRENT position.
			if (rotPosY == false){
				rotNegY = false;
				rotPosY = true;	
			}else{
				rotPosY = false;
			}
			break;
		case 'P':
		case 'p':
			//Rotate your wireframe in an -Y-roll about it's CURRENT position.
			if(rotNegY == false){
				rotNegY = true;
				rotPosY = false;
			}else{
				rotNegY = false;
			}
			break;

		case 'L':
		case 'l':
			//Rotate your wireframe in an +Z-roll about it's CURRENT position.
			if(rotNegZ == false){
				rotNegZ = true;
				rotPosZ = false;
			}else{
				rotNegZ = false;
			}
			break;
		case 'K':
		case 'k':
			//Rotate your wireframe in an -Z-roll about it's CURRENT position.
			if(rotPosZ==false){
				rotNegZ = false;
				rotPosZ = true;
			}else{
				rotPosZ = false;
			}

			break;

		case 'B':
		case 'b':
			if (pulse == false){//turn on
				pulse = true;				
			}else{//turn off
				pulse = false;
			}
			//Toggle pulsing meshes
			break;
		case 'Q':
		case 'q':
			//stop all actions
			//disable translation
			transPosX = false;
			transNegX = false;
			transPosY = false;
			transNegY = false;
			transPosZ = false;
			transNegZ = false;
			//disable rotations
			rotNegX = false;
			rotPosX = false;
			rotNegY = false;
			rotPosY = false;
			rotNegZ = false;
			rotPosZ = false;
			//pulse settings
			t = 0
			pulse = false;
			set_colors(false);
			break;		
		case 'W':
		case 'w':
			//reset translations
			dx = 0;
			dy = 0;
			dz = 0;
			//reset rotation
			theta = 0;
			beta = 0;
			gamma = 0;
			//reset pulse
			pulseIndex = 0;
			break;
		default:
			var outputMessage = 'No function set for keypress: ' + theKey + '<br>';		//clear the output message			
	}

	outputMessage = 'Current keypress actions are: <br>';
	outputMessage += '- Translations: <br>';
	outputMessage += "-- ' X ' or ' x ' Translate your wireframe in the + x direction. <br>";
	outputMessage += "-- ' C ' or ' c ' Translate your wireframe in the - x direction.<br>";
	outputMessage += "-- ' y ' or ' y ' Translate your wireframe in the + y direction.<br>";
	outputMessage += "-- ' U ' or ' u ' Translate your wireframe in the - y direction.<br>";
	outputMessage += "-- ' Z ' or ' z ' Translate your wireframe in the + z direction. <br>";
	outputMessage += "-- ' A ' or ' a ' Translate your wireframe in the - z direction.<br>";
	outputMessage += '- Rotations: <br>';
	outputMessage += "-- ' R ' or ' r ' Rotate your wireframe in an + roll about it's CURRENT position.<br>";
	outputMessage += "-- ' T ' or ' T ' Rotate your wireframe in an - roll about it's CURRENT position.<br>";
	outputMessage += "-- ' O ' or ' o ' Rotate your wireframe in an + pitch about it's CURRENT position.<br>";
	outputMessage += "-- ' P ' or ' p ' Rotate your wireframe in an - pitch about it's CURRENT position.<br>";
	outputMessage += "-- ' K ' or ' k ' Rotate your wireframe in an + yaw about it's CURRENT position.<br>";
	outputMessage += "-- ' L ' or ' l ' Rotate your wireframe in an - yaw about it's CURRENT position.<br>";
	outputMessage += '- Pulse <br>';
	outputMessage += "-- ' B ' or ' b ' Toggle pulsing meshes. <br>";
	outputMessage += '- Normals <br>';
	outputMessage += "-- ' D ' or ' d ' Toggle normal lines. <br>";
	outputMessage += '- Reset <br>';
	outputMessage += "-- ' Q ' or ' q ' Turns off translations/rotations. <br>";
	outputMessage += "-- ' W ' or ' w ' Resets the mesh to the orgin. <br>";
	document.getElementById('pageContent').innerHTML = outputMessage;
	update_state_output();
}

function display_file_metadata(plyDataType, endHeader, numberVertices, numberPolygons,
	processedVertices, processedPolygons) {
	/*
		This function displays metadata parsed from the a textfile at the end.
		 this infomation is displayed belwo the broswe button. The infomation 
		 shown in the file name, file size, number of vertices, and number of 
		 polygones in the file.
	
			Error messages will occur if ply or end_header tags are missing from header.
	
		warning messages will fire if mismatch between header and processed data. 
	*/

	var uploadedFile = document.getElementById("ply-file");
	var outputMessage = "";		//clear the output message
	var file = uploadedFile.files[0]; // sinse we are only working with one file, get the first element
	if ('name' in file) {
		outputMessage += "------- Metadata -------<br>"; //display the file name
		outputMessage += "File name: " + file.name + "<br>"; //display the file name
	}
	if ('size' in file) {
		outputMessage += "File size: " + file.size + " bytes <br>"; //display the size of the file
	}

	if (plyDataType == true && numberVertices == processedVertices && numberPolygons == processedPolygons) {
		outputMessage += "Number of Vertices: " + numberVertices + ", Number of vertices processed: " + processedVertices + "<br>";
		outputMessage += "Number of Polygons: " + numberPolygons + ", Number of polygons processed: " + processedPolygons + "<br>";
	} else if (plyDataType == false) {
		outputMessage += "Error! File header 'ply' tag not set. Add the 'ply' tag to the header to continue with this file. Exiting parsing...<br>"; //no ply txt string in header
	} else if (endHeader == false) {
		outputMessage += "Error! File header 'end_header' tag not set. Add the 'end_header' tag to the header to continue with this file. Exiting parsing...<br>"; //no ply txt string in header
	}
	if (numberVertices != processedVertices && (plyDataType != false && endHeader != false)) {
		outputMessage += "Warning! Mismatch in file header and data. Header lists: " + numberVertices + " vertices and processed: " + processedVertices + " vertices. <br>";
	}
	if (numberPolygons != processedPolygons && (plyDataType != false && endHeader != false)) {
		outputMessage += "Warning! Mismatch in file header and data. Header lists: " + numberPolygons + " vertices and processed: " + processedPolygons + " vertices. <br>";
	}
	document.getElementById("pageContent").innerHTML = outputMessage;	//display output to mess
}

function parse_ply_file(vertexCoordsList, polygonIndexList, rawText) {
	/*
		This parser will process raw text uploaded to the application. The parser will
		 split the text by new lines and then by white space to process each word inside
		 raw text. The parser will read in the header information if header fails, the 
		 program will return an error message to the screen. If it passes the the 
		 coordinates of the vertices will be parsed as vec4s and the polygons will be 
		 processed in turn as vec4 as required. if the index is only moves 3 times the
		 parser assumes 
	
		file format
		---
		ply											***Required tag
		format ascii 1.0			
		element vertex 8							
		property float32 x
		property float32 y
		property float32 z
		element face 12
		property list uint8 int32 vertex_indices
		end_header									***Required tag
		
		-0.5 -0.5 -0.5 	//vertex format
		3 3 2 1			//polygon format
		---
	
		returns [list,list,list]
	*/
	vertexCoordsList = [];			// clear the vertex list
	polygonIndexList = [];			// clear the polygon list
	var endHeader = false;			// bool end of header marker
	var plyDataType = false;		// bool ply designation present in file header
	var vertexIndex = 0;			// int index of vertices
	var polygonIndex = 0;			// int index of polygon
	var x_max = 0;
	var x_min = 0;
	var y_max = 0;
	var y_min = 0;
	var z_max = 0;
	var z_min = 0;

	var lines = rawText.split(/\r?\n/g);			//split the string by new lines
	for (i = 0; i < lines.length; i++) {					//for line in lines
		var point = vec4(0.0, 0.0, 0.0, 1.0);		//  points to be written too
		var index = 0;								//  indexes points written
		var lineArray = lines[i].split(/(\s+)/);	//  split the string by spaces
		for (ii = 0; ii < lineArray.length; ii++) {			//  for each item in the line, cast to float 
			if (lineArray[ii].length > 0) {			//		if the item exists(skip empty lines)
				if (endHeader == false) {			//	parse the header
					switch (lineArray[ii]) {
						case 'ply':
							plyDataType = true;
							break;
						case 'vertex':
							numberVertices = parseInt(lineArray[lineArray.length - 1]);
							break;
						case 'face':
							numberPolygons = parseInt(lineArray[lineArray.length - 1]);
							break;
						case 'end_header':
							endHeader = true;
							break;
						default:
						//do nothing
					}
				} else {							//parse the file content						
					var floatCast = parseFloat(lineArray[ii])	//cast string to float
					if (!isNaN(floatCast))				// 	if not NaN, set as point
					{
						point[index] = floatCast;		// set point to float value
						index++							//	increment the counter
					}
				}
			}
		}

		if (endHeader == true && plyDataType == true) {
			if (index > 0) {								//if values have been set
				if (index == 3) {							// four values set mean its a extent (homogeneous unit will not change in this app)
					vertexCoordsList[vertexIndex] = point;
					// vertexCoordsList.push(point);
					vertexIndex++;
					//update extents
					if (point[0] > x_max) {
						x_max = point[0];
					} else if (point[0] < x_min) {
						x_min = point[0];
					}
					if (point[1] > y_max) {
						y_max = point[1];
					} else if (point[1] < y_min) {
						y_min = point[1];
					}
					if (point[2] > z_max) {
						z_max = point[2];
					} else if (point[2] < z_min) {
						z_min = point[2];
					}
					avgX += point[0];
					avgY += point[1];
					avgZ += point[2];

				} else if (index == 4) {
					polygonIndexList[polygonIndex] = point;
					// numberPolygons.push(point);				// set total number of vertices
					polygonIndex++;
				} else {
					console.log("Warning, line " + i + " has more than 4 items.");// do nothing, log line to console 
				}
			}
		}
	}
	avgX/=vertexCoordsList.length;	//
	avgY/=vertexCoordsList.length;	//
	avgZ/=vertexCoordsList.length;	//
	// display_file_metadata(plyDataType, endHeader, numberVertices, numberPolygons, vertexIndex, polygonIndex);
	return [vertexCoordsList, polygonIndexList, [x_min, y_min, z_min, x_max, y_max, z_max]];
}

function normal_newell_method(vectors){
	/*
		Computes the normal via the newwell method for the m_x, m_y, and m_z

		returns [m_x,m_y,m_z]
	*/

	var normal = vec3(0.0,0.0,0.0); // [m_x,m_y,m_z]

	//mx - sum(y-y_1)*(z+z_1)
	var sum = 0;
		for(ii=0;ii<vectors.length-1;ii++){	
			sum += (vectors[ii][1]-vectors[ii+1][1])*
				(vectors[ii][2]+vectors[ii+1][2]);	
		}
	normal[0] = sum;
	//my - sum(z-z_1)*(x+x_1)
	var sum = 0;
		for(ii=0;ii<vectors.length-1;ii++){	
			sum += (vectors[ii][2]-vectors[ii+1][2])*
				(vectors[ii][0]+vectors[ii+1][0]);		
		}
	normal[1] = sum
	
	//mz - sum(x-x_1)*(y+y_1)
	var sum = 0;
		for(ii=0;ii<vectors.length-1;ii++){	
			sum += (vectors[ii][0]-vectors[ii+1][0])*
				(vectors[ii][1]+vectors[ii+1][1]);	
		}
	normal[2] = sum;	
	return normal;
}

function construct_polygon_points(vertexCoordsList, polygonIndexList)
{
	/*
		this function constructs the list of points for each polygon to drawn to the screen. Each polygon
		 is held inside a nested list where:

		 ploygons= [
			polygon_n =[
				points = [
					vec4(),
					vec4(),
					vec4(),
				],
				colors = [
					vec4(),
					vec4(),
					vec4(),
				]
				normal = vec4();
				displacement=vec4();
				alpha =0;
				directionality = 1;
				p
				]
			],
		 ]
		 returns [polygons]
	*/

	var polygons = [];
	for(i=0;i<polygonIndexList.length;i++){
		var polygon = [[],[],[]];
		var a = polygonIndexList[i][1]
		var b = polygonIndexList[i][2]
		var c = polygonIndexList[i][3]
		var indices = [ a, b, c, a ];
		for (var ii = 0; ii < indices.length; ++ii ){
			polygon[0][ii] = vertexCoordsList[indices[ii]];		// vertices list
			polygon[1][ii] = [1.0, 1.0, 1.0, 0.0];   			// color list
			points.push(polygon[0][ii]);
			colors.push(polygon[1][ii]);
		}
		polygon[2] = normal_newell_method(polygon[0]);			// normal
		polygon[3] = vec3(0.0,0.0,0.01);   						// displacement
		polygon[4] = 0;											// alpha
		polygon[5] = triangle_centroid(polygon[0],polygon[2]);	// directionality constant	
		polygon[6] = polygon_pulse(polygon[0],polygon[2]);		// list of normal displacment
		polygons[i] = polygon;									//store polygon in the array
		points.push(polygon[5][0],polygon[5][1]);
		colors.push(vec4(0.0,1.0,0.0,1),vec4(0.0,1.0,0.0,1));
	}
	return polygons;
}

function triangle_centroid(polygon,normal){
	//calculate teh centroid of a polygon. 

	var originX = (polygon[0][0]+polygon[1][0]+polygon[2][0])/3;
	var originY = (polygon[0][1]+polygon[1][1]+polygon[2][1])/3;
	var originZ = (polygon[0][2]+polygon[1][2]+polygon[2][2])/3;
	var centroid = vec4(originX,
						originY,
						originZ,
						1);	
	var centroidLine = vec4(originX + normalLineScale*normal[0],
							originY + normalLineScale*normal[1],
							originZ + normalLineScale*normal[2],
							1);	
	return [centroid,centroidLine];
}

function polygon_pulse(polygon,normal){
	/*
		Displaces a polygon a using the following equation: 		c*n*sin(alpha)*100
			where: c is the scaling factor, n is the normal, sin(alpha) is the direction. Alpha is scaled between 
			0.0 -> pi/16. When alpha exceeds each limit the directional is changed to reverse the interpolation.
	*/
	var displacements = [vec3((0.0,0.0,0.0))];
	var normalDisplacement = 0;
	var alpha =0.01;
	var direction = 1;

	while (alpha >0){
		normalDisplacement = Math.sin(alpha);
		if (alpha>=0.05){  
			direction *= -1; // multiply by the directionality constant
		}
		alpha +=0.01*direction;
		displacements.push(vec3(
			pulseScale*normal[0]*normalDisplacement, 	//x
			pulseScale*normal[1]*normalDisplacement, 	//y
			pulseScale*normal[2]*normalDisplacement)); 	//z
	}
	return displacements;
}