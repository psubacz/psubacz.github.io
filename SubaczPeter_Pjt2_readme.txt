Subacz Project 1 Read Me

These folder contain:
    - subacz_pjt_2.html
    - subacz_pjt_2.js
    - SubaczPeter_Pjt2_readme.txt (this file)
    - cs4731_pjt2_ply_files (directory)
    - lib (directory)

This project draws .ply ingests .ply files and displays the object in a html canvas.
The project has the following modes:
 * 	Translate around the XYZ:
 * 		Press ' X ' or ' x ' Translate your wireframe in the + x
 * 		Press ' C ' or ' c ' Translate your wireframe in the - x
 * 		Press ' y ' or ' y ' Translate your wireframe in the + y
 * 		Press ' U ' or ' u ' Translate your wireframe in the - y
 * 		Press ' Z ' or ' z ' Translate your wireframe in the + z
 * 		Press ' A ' or ' a ' Translate your wireframe in the - z
 * 	Rotate around the Roll,Pitch,Yaw
 * 		Press ' R ' or ' r ' Rotate your wireframe in an + Roll
 * 		Press ' T ' or ' t ' Rotate your wireframe in an - Roll
 * 		Press ' P ' or ' P ' Rotate your wireframe in an - Pitch
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

At runtime, the program:
0.  Reset translations and reset rotations
1.  Ingest a file
2.  Build polygons 
2.1 Calculate normals
2.2 Calculate centroids
2.3 Calculate pulses
3.  Calculate animation delay
4.  Recusively render
