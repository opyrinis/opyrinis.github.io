var vertexShaderText = `
    precision highp float;

    uniform vec2 canvas_resolution;
    attribute vec2 position;

    varying vec2 uv;

    void main() {
        vec2 webGL_position = ((position / canvas_resolution) * 2.0) - 1.0;
        
        uv = position / canvas_resolution;
        gl_Position = vec4(webGL_position, 0.0, 1.0);
    }
`

// For color being output onto canvas
var fragmentShaderColor = `
    precision highp float;
    precision highp sampler2D;

    uniform float dt;
    uniform sampler2D velocityMap;
    uniform sampler2D pressureMap;
    uniform sampler2D divergenceMap;
    uniform sampler2D colorMap;

    varying vec2 uv;

    vec2 wrap(vec2 pos){
        if (pos[0] > 1.0) {
            pos[0] = pos[0] - 1.0;
        } else if (pos[0] < 0.0) {
            pos[0] = pos[0] + 1.0;
        }

        if (pos[1] > 1.0) {
            pos[1] = pos[0] - 1.0;
        } else if (pos[1] < 0.0) {
            pos[1] = pos[0] + 1.0;
        }
        return pos;
    }

    void main() {
        vec2 velocity = vec2(texture2D(velocityMap, uv));
        vec2 prev_uv = wrap(uv - (velocity * dt));
        gl_FragColor = texture2D(colorMap, prev_uv);



/*        
        //color velocity map
        vec4 color = vec4(velocity.xy, 0.0, 1.0);        
        if (velocity.x < 0.0 && velocity.y >= 0.0) {
            color.z = abs(velocity.x);
        } else if (velocity.y < 0.0 && velocity.x >= 0.0) {
            color.z = abs(velocity.y);
        } else if (velocity.x < 0.0 && velocity.y < 0.0) {
            color.z = (abs(velocity.x) + abs(velocity.y)) / 2.0;
        }
        //vec4 color = clamp(texture2D(velocityMap, uv), 0.0, 1.0);
        gl_FragColor = color;

*/

/*
        //color the pressure map
        float pressure = (texture2D(pressureMap, uv) * 3.0).x;
        vec4 color = vec4(0.0, abs(pressure), 0.0, 1.0);
        if (pressure < 0.0) {
            color.b = abs(pressure);
        } else {
            color.r = pressure;
        }
        gl_FragColor = color;
*/


/*
        // color the divergence map
        float divergence = (texture2D(divergenceMap, uv) * 20.0).x;
        vec4 color = vec4(0.0, abs(divergence), 0.0, 1.0);
        if (divergence < 0.0) {
            color.b = abs(divergence);
        } else {
            color.r = divergence;
        }
        gl_FragColor = color;
*/
    }
`

var fragmentShaderAdvection = `
    precision highp float;
    precision highp sampler2D;

    uniform sampler2D velocityMap;
    uniform float dt;

    varying vec2 uv;

    vec2 wrap(vec2 pos){
        if (pos[0] > 1.0) {
            pos[0] = pos[0] - 1.0;
        } else if (pos[0] < 0.0) {
            pos[0] = pos[0] + 1.0;
        }

        if (pos[1] > 1.0) {
            pos[1] = pos[0] - 1.0;
        } else if (pos[1] < 0.0) {
            pos[1] = pos[0] + 1.0;
        }
        return pos;
    }

    void main() {
        vec2 velocity = texture2D(velocityMap, uv).xy;
        vec2 prev_uv = wrap(uv - (velocity * dt * 0.5));
        gl_FragColor = texture2D(velocityMap, prev_uv);
    }
`

// for updating the velocity + pressure (advecting)
var fragmentShaderVelocity = `
    precision highp float;
    precision highp sampler2D;

    uniform sampler2D velocityMap;
    uniform sampler2D pressureMap;
    uniform vec2 epsilon;
    uniform float density;
    uniform float dt;

    varying vec2 uv;

    vec2 wrap(vec2 pos){
        if (pos[0] > 1.0) {
            pos[0] = pos[0] - 1.0;
        } else if (pos[0] < 0.0) {
            pos[0] = pos[0] + 1.0;
        }

        if (pos[1] > 1.0) {
            pos[1] = pos[0] - 1.0;
        } else if (pos[1] < 0.0) {
            pos[1] = pos[0] + 1.0;
        }
        return pos;
    }

    void main() {
        vec2 x_epsilon = vec2(epsilon.x, 0.0);
        vec2 y_epsilon = vec2(0.0, epsilon.y);

        vec2 current_velocity = texture2D(velocityMap, uv).xy;
        
        vec2 epsilon2 = 2.0 * epsilon;
        float rdensity = 1.0 / density;

        float x1_pressure = texture2D( pressureMap, wrap(uv + x_epsilon) ).x;
        float x2_pressure = texture2D( pressureMap, wrap(uv - x_epsilon) ).x;
        float y1_pressure = texture2D( pressureMap, wrap(uv + y_epsilon) ).x;
        float y2_pressure = texture2D( pressureMap, wrap(uv - y_epsilon) ).x;

        float new_x_velocity = current_velocity.x - dt / (2.0 * density * epsilon.x) * (x1_pressure - x2_pressure);
        float new_y_velocity = current_velocity.y - dt / (2.0 * density * epsilon.y) * (y1_pressure - y2_pressure);

        gl_FragColor = vec4(new_x_velocity, new_y_velocity, 0.0, 1.0);
    }
`

// For color being output onto canvas
var fragmentShaderPressureJacobi = `
    precision highp float;
    precision highp sampler2D;

    uniform sampler2D divergenceMap;
    uniform sampler2D pressureMap;
    uniform vec2 epsilon;

    varying vec2 uv;

    vec2 wrap(vec2 pos){
        if (pos[0] > 1.0) {
            pos[0] = pos[0] - 1.0;
        } else if (pos[0] < 0.0) {
            pos[0] = pos[0] + 1.0;
        }

        if (pos[1] > 1.0) {
            pos[1] = pos[0] - 1.0;
        } else if (pos[1] < 0.0) {
            pos[1] = pos[0] + 1.0;
        }
        return pos;
    }

    void main() {
        float divergence = texture2D(divergenceMap, uv).x;

        vec2 xOffset = vec2(2.0 * epsilon.x, 0.0);
        vec2 yOffset = vec2(0.0, 2.0 * epsilon.y);
        
        float sample1 = texture2D(pressureMap, wrap(uv + xOffset)).x;
        float sample2 = texture2D(pressureMap, wrap(uv - xOffset)).x;
        float sample3 = texture2D(pressureMap, wrap(uv + yOffset)).x;
        float sample4 = texture2D(pressureMap, wrap(uv - yOffset)).x;

        vec4 pressure = vec4( (divergence + sample1 + sample2 + sample3 + sample4) * 0.25, 0.0, 0.0, 1.0);
        gl_FragColor = pressure;
    }
`

var fragmentShaderDivergence = `
    precision highp float;
    precision highp sampler2D;

    uniform sampler2D velocityMap;
    uniform vec2 epsilon;
    uniform float density;
    uniform float dt;

    varying vec2 uv;

    vec2 wrap(vec2 pos){
        if (pos[0] > 1.0) {
            pos[0] = pos[0] - 1.0;
        } else if (pos[0] < 0.0) {
            pos[0] = pos[0] + 1.0;
        }

        if (pos[1] > 1.0) {
            pos[1] = pos[0] - 1.0;
        } else if (pos[1] < 0.0) {
            pos[1] = pos[0] + 1.0;
        }
        return pos;
    }

    void main() {
        vec2 scalar = -2.0 * epsilon * density / dt;
        vec2 offsetX = vec2(epsilon.x, 0.0);
        vec2 offsetY = vec2(0.0, epsilon.y);

        float divergenceX = (texture2D( velocityMap, wrap(uv + offsetX) ).x - texture2D( velocityMap, wrap(uv - offsetX) ).x);
        float divergenceY = (texture2D( velocityMap, wrap(uv + offsetY) ).y - texture2D( velocityMap, wrap(uv - offsetY) ).y);
        
        gl_FragColor = vec4( (divergenceX * scalar.x) + (divergenceY * scalar.y), 0.0, 0.0, 1.0 );
    }
`


function buildProgram(gl, vertexShaderSource, fragmentShaderSource) {
    //compile and initialize the shaders
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.shaderSource(fragmentShader, fragmentShaderSource);

    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('Error compiling vertex shader', gl.getShaderInfoLog(vertexShader));
        return;
    }

    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('Error compiling vertex shader', gl.getShaderInfoLog(fragmentShader));
        return;
    }

    //attach the compiled shaders to a program
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking shader program', gl.getProgramInfoLog(program));
        return;
    }

    gl.validateProgram(program);    // remove this and subsequent if condition for release (only use for debugging)
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        console.error('Error validating program', gl.getProgramInfoLog(program));
        return;
    }

    return program;
}


function initializeSimulation() {
    var canvas = document.getElementById('glcanvas');
    var gl = canvas.getContext('webgl2');
  
    // If we don't have a GL context, give up now  
    if (!gl) {
      gl = canvas.getContext('experimental-webgl');
    }
    if (!gl) {
      alert('Unable to initialize WebGL. Your browser or machine may not support it.');
      return;
    }
  
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.addEventListener('mousedown', function(e) {
        getCursorPosition(canvas, e);
    });

    gl.getExtension('EXT_color_buffer_float');
  
    gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);  //initialize canvas background color to black
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //compile and build our shader program
    var programColorMap = buildProgram(gl, vertexShaderText, fragmentShaderColor);
    if (!programColorMap) {
        console.error('Color Shader program build failed');
        return;
    }

    var programVelocityMap = buildProgram(gl, vertexShaderText, fragmentShaderVelocity);
    if (!programVelocityMap) {
        console.error('Velocity Shader program build failed');
        return;
    }

    var programPressureMap = buildProgram(gl, vertexShaderText, fragmentShaderPressureJacobi);
    if (!programPressureMap) {
        console.error('Pressure Shader program build failed');
        return;
    }

    var programDivergenceMap = buildProgram(gl, vertexShaderText, fragmentShaderDivergence);
    if (!programDivergenceMap) {
        console.error('Divergence Shader program build failed');
        return;
    }

    var programAdvection = buildProgram(gl, vertexShaderText, fragmentShaderAdvection);
    if (!programAdvection) {
        console.error('Advection Shader program build failed');
        return;
    }

    var colorMapFiltering = gl.LINEAR; // can switch between NEAREST and LINEAR
    /*
     * Now that the shader program has been compiled and linked, we need to create the buffers that will be used by the shader program
    */
    var canvasCorners = [
        //X, Y
        0, 0,
        canvas.width, canvas.height,
        0, canvas.height,
        0, 0,
        canvas.width, 0,
        canvas.width, canvas.height
    ]

    var triangleCornersBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleCornersBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(canvasCorners), gl.STATIC_DRAW);  
    

    /* Define and initialize color map as 2D texture */
    var colorMap = [canvas.width * canvas.height * 4];
    var velocityMap = [canvas.width * canvas.height * 4];
    var pressureMap = [canvas.width * canvas.height * 4];
    var divergenceMap = [canvas.width * canvas.height * 4];
    var white = true;
    for (var x = 0; x < canvas.width; x++) {
        for (var y = 0; y < canvas.height; y++) {
            var glX = ((x / canvas.width) * 2.0) - 1.0;
            var glY = ((y / canvas.height) * 2.0) - 1.0;
            
            colorMap[(y * canvas.width + x) * 4] = x / canvas.width * 255;    //red channel
            colorMap[((y * canvas.width + x) * 4) + 1] = y / canvas.height * 255;  //green channel
            colorMap[((y * canvas.width + x) * 4) + 2] = 0.0; //blue channel
            colorMap[((y * canvas.width + x) * 4) + 3] = 255;   //alpha channel

            //velocityMap[(y * canvas.width + x) * 4] = Math.sin(2.0 * Math.PI * glY);
            //velocityMap[((y * canvas.width + x) * 4) + 1] = Math.sin(2.0 * Math.PI * glX);
            velocityMap[(y * canvas.width + x) * 4] = Math.cos(2.0 * Math.PI * glY);
            velocityMap[((y * canvas.width + x) * 4) + 1] = Math.cos(2.0 * Math.PI * glX);
            velocityMap[((y * canvas.width + x) * 4) + 2] = 0.0;
            velocityMap[((y * canvas.width + x) * 4) + 3] = 1.0;

            pressureMap[(y * canvas.width + x) * 4] = 0.0;
            pressureMap[((y * canvas.width + x) * 4) + 1] = 0.0;
            pressureMap[((y * canvas.width + x) * 4) + 2] = 0.0;
            pressureMap[((y * canvas.width + x) * 4) + 3] = 0.0;

            divergenceMap[(y * canvas.width + x) * 4] = 0.0;
            divergenceMap[((y * canvas.width + x) * 4) + 1] = 0.0;
            divergenceMap[((y * canvas.width + x) * 4) + 2] = 0.0;
            divergenceMap[((y * canvas.width + x) * 4) + 3] = 1.0;
        }
    }

    var colorMapArray = new Uint8Array(colorMap);

    gl.activeTexture(gl.TEXTURE0);
    var colorMapTexture0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, colorMapTexture0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, colorMapFiltering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, colorMapFiltering);

    gl.texImage2D(
        gl.TEXTURE_2D,  //specify target (two-dimensional texture) 
        0,  // specify the level 0
        gl.RGBA,    //using red, green, blue, and alpha channels
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,    //specifies the format of the texel data (vec4)
        gl.UNSIGNED_BYTE,   // data type of the texel data
        colorMapArray    // array pixel source
    );


    gl.activeTexture(gl.TEXTURE1);
    var colorMapTexture1 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, colorMapTexture1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, colorMapFiltering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, colorMapFiltering);

    gl.texImage2D(
        gl.TEXTURE_2D,  //specify target (two-dimensional texture) 
        0,  // specify the level 0
        gl.RGBA,    //using red, green, blue, and alpha channels
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,    //specifies the format of the texel data (vec4)
        gl.UNSIGNED_BYTE,   // data type of the texel data
        null    // array pixel source
    );

    var frameBufferColor = gl.createFramebuffer();

    //Define and initalize velocity field map as 2D texture
    var velocityMapArray = new Float32Array(velocityMap);

    gl.activeTexture(gl.TEXTURE2);
    var velocityMapTexture0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, velocityMapTexture0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(
        gl.TEXTURE_2D,  //specify target (two-dimensional texture) 
        0,  // specity the level 0
        gl.RGBA32F,    //using red, green, blue, and alpha float channels
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,    //specifies the format of the texel data (vec4)
        gl.FLOAT,   // data type of the texel data
        velocityMapArray    // array pixel source
    );


    gl.activeTexture(gl.TEXTURE3);
    var velocityMapTexture1 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, velocityMapTexture1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(
        gl.TEXTURE_2D,  //specify target (two-dimensional texture) 
        0,  // specity the level 0
        gl.RGBA32F,    //using red, green, blue, and alpha float channels
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,    //specifies the format of the texel data (vec4)
        gl.FLOAT,   // data type of the texel data
        null    // array pixel source
    );

    var frameBufferVelocity = gl.createFramebuffer();

    //Define and initalize pressure map as 2D texture
    var pressureMapArray = new Float32Array(pressureMap);

    gl.activeTexture(gl.TEXTURE4);
    var pressureMapTexture0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, pressureMapTexture0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(
        gl.TEXTURE_2D,  //specify target (two-dimensional texture) 
        0,  // specity the level 0
        gl.RGBA32F,    //using red, green channels
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,    //specifies the format of the texel data (vec2)
        gl.FLOAT,   // data type of the texel data
        pressureMapArray    // array pixel source
    );


    gl.activeTexture(gl.TEXTURE5);
    var pressureMapTexture1 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, pressureMapTexture1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(
        gl.TEXTURE_2D,  //specify target (two-dimensional texture) 
        0,  // specity the level 0
        gl.RGBA32F,    //using red, green, blue, and alpha float channels
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,    //specifies the format of the texel data (vec4)
        gl.FLOAT,   // data type of the texel data
        null    // array pixel source
    );

    var frameBufferPressure = gl.createFramebuffer();

    //Define and initalize divergence map as 2D texture
    var divergenceMapArray = new Float32Array(divergenceMap);
    //var divergenceMapArray = new Uint8Array(divergenceMap);

    gl.activeTexture(gl.TEXTURE6);
    var divergenceMapTexture0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, divergenceMapTexture0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(
        gl.TEXTURE_2D,  //specify target (two-dimensional texture) 
        0,  // specity the level 0
        gl.RGBA32F,    //using red, green, blue, alpha, float channels
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,    //specifies the format of the texel data (vec4)
        gl.FLOAT,   // data type of the texel data
        divergenceMapArray    // array pixel source
    );

    var frameBufferDivergence = gl.createFramebuffer();
    
    gl.useProgram(programColorMap);
    var canvasResolutionLocation_programColorMap = gl.getUniformLocation(programColorMap, 'canvas_resolution');
    var positionLocation_programColorMap = gl.getAttribLocation(programColorMap, 'position');
    var dtLocation_programColorMap = gl.getUniformLocation(programColorMap, 'dt');
    var velocityMapLocation_programColorMap = gl.getUniformLocation(programColorMap, 'velocityMap');
    var colorMapLocation_programColorMap = gl.getUniformLocation(programColorMap, 'colorMap');
    var pressureMapLocation_programColorMap = gl.getUniformLocation(programColorMap, 'pressureMap');
    var divergenceMapLocation_programColorMap = gl.getUniformLocation(programColorMap, 'divergenceMap');

    gl.useProgram(programAdvection);
    var canvasResolutionLocation_programAdvection = gl.getUniformLocation(programAdvection, 'canvas_resolution');
    var positionLocation_programAdvection = gl.getAttribLocation(programAdvection, 'position');
    var mapLocation_programAdvection = gl.getUniformLocation(programAdvection, 'velocityMap');
    var dtLocation_programAdvection = gl.getUniformLocation(programAdvection, 'dt');

    gl.useProgram(programVelocityMap);
    var canvasResolutionLocation_programVelocityMap = gl.getUniformLocation(programVelocityMap, 'canvas_resolution');
    var positionLocation_programVelocityMap = gl.getAttribLocation(programVelocityMap, 'position');
    var velocityMapLocation_programVelocityMap = gl.getUniformLocation(programVelocityMap, 'velocityMap');
    var pressureMapLocation_programVelocityMap = gl.getUniformLocation(programVelocityMap, 'pressureMap');
    var epsilonLocation_programVelocityMap = gl.getUniformLocation(programVelocityMap, 'epsilon');
    var densityLocation_programVelocityMap = gl.getUniformLocation(programVelocityMap, 'density');
    var dtLocation_programVelocityMap = gl.getUniformLocation(programVelocityMap, 'dt');

    gl.useProgram(programPressureMap);
    var canvasResolutionLocation_programPressureMap = gl.getUniformLocation(programPressureMap, 'canvas_resolution');
    var positionLocation_programPressureMap = gl.getAttribLocation(programPressureMap, 'position');
    var divergenceMapLocation_programPressureMap = gl.getUniformLocation(programPressureMap, 'divergenceMap');
    var pressureMapLocation_programPressureMap = gl.getUniformLocation(programPressureMap, 'pressureMap');
    var epsilonLocation_programPressureMap = gl.getUniformLocation(programPressureMap, 'epsilon');

    gl.useProgram(programDivergenceMap);
    var canvasResolutionLocation_programDivergenceMap = gl.getUniformLocation(programDivergenceMap, 'canvas_resolution');
    var positionLocation_programDivergenceMap = gl.getAttribLocation(programDivergenceMap, 'position');
    var velocityMapLocation_programDivergenceMap = gl.getUniformLocation(programDivergenceMap, 'velocityMap');
    var epsilonLocation_programDivergenceMap = gl.getUniformLocation(programDivergenceMap, 'epsilon');
    var densityLocation_programDivergenceMap = gl.getUniformLocation(programDivergenceMap, 'density');
    var dtLocation_programDivergenceMap = gl.getUniformLocation(programDivergenceMap, 'dt');


    var dt = 1.0 / 360.0;
    var density = 0.7;    
    //var epsilon = Math.min(1.0 / canvas.width, 1.0 / canvas.height);
    var epsilonX = 1.0 / canvas.width;
    var epsilonY = 1.0 / canvas.height;
    const jacobi_iteration = 30;

    var colorMapTexture;
    var pressureMapTexture;

    /*
     *  Main render loop
    */
    var loop = function () {        
        if (!renderToTexture0) {
            colorMapTexture = colorMapTexture1;
            pressureMapTexture = pressureMapTexture1;
        } else {
            colorMapTexture = colorMapTexture0;
            pressureMapTexture = pressureMapTexture0;
        }


        // advect velcity through itself
        gl.useProgram(programAdvection);
        gl.vertexAttribPointer(
            positionLocation_programAdvection, // Attribute location
            2,  // Number of elements per attribute
            gl.FLOAT,   // Type of elements
            gl.FALSE,   // are elements normalized
            2 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
            0   // Offset from the beginning of a single vertex to this attribute
        );
        gl.enableVertexAttribArray(positionLocation_programAdvection);

        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferVelocity);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, //target specifying the binding point
            gl.COLOR_ATTACHMENT0,    //attaches the texture to the framebuffer's color buffer
            gl.TEXTURE_2D,  //its a 2D image
            velocityMapTexture1,   //object whose image to attach
            0   //specify the mipmap level
        );
        gl.uniform2f(canvasResolutionLocation_programAdvection, canvas.width, canvas.height);
        gl.uniform1f(dtLocation_programAdvection, dt);
        gl.uniform1i(mapLocation_programAdvection, 2);  //read from velocity map texture 0
        gl.drawArrays(gl.TRIANGLES, 0, 6);






        // calculate divergence for the advected velocities
        gl.useProgram(programDivergenceMap);
        gl.vertexAttribPointer(
            positionLocation_programDivergenceMap, // Attribute location
            2,  // Number of elements per attribute
            gl.FLOAT,   // Type of elements
            gl.FALSE,   // are elements normalized
            2 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
            0   // Offset from the beginning of a single vertex to this attribute
        );
        gl.enableVertexAttribArray(positionLocation_programDivergenceMap);

        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferDivergence);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, //target specifying the binding point
            gl.COLOR_ATTACHMENT0,    //attaches the texture to the framebuffer's color buffer
            gl.TEXTURE_2D,  //its a 2D image
            divergenceMapTexture0,   //object whose image to attach
            0   //specify the mipmap level
        );
        gl.uniform2f(canvasResolutionLocation_programDivergenceMap, canvas.width, canvas.height);
        gl.uniform1i(velocityMapLocation_programDivergenceMap, !renderToTexture0 + 2);
        gl.uniform2f(epsilonLocation_programDivergenceMap, epsilonX, epsilonY);
        gl.uniform1f(densityLocation_programDivergenceMap, density);
        gl.uniform1f(dtLocation_programDivergenceMap, dt);
        gl.drawArrays(gl.TRIANGLES, 0, 6);








        // calculate pressure based on divergence map using jacobi iteration
        gl.useProgram(programPressureMap);
        gl.vertexAttribPointer(
            positionLocation_programPressureMap, // Attribute location
            2,  // Number of elements per attribute
            gl.FLOAT,   // Type of elements
            gl.FALSE,   // are elements normalized
            2 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
            0   // Offset from the beginning of a single vertex to this attribute
        );
        gl.enableVertexAttribArray(positionLocation_programPressureMap);

        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferPressure);
        gl.uniform2f(canvasResolutionLocation_programPressureMap, canvas.width, canvas.height);
        gl.uniform1i(divergenceMapLocation_programPressureMap, 6);
        gl.uniform2f(epsilonLocation_programPressureMap, epsilonX, epsilonY);

        for (var i = 0; i < jacobi_iteration; i++) {
            if (i % 2 == 0) {
                pressureMapTexture = pressureMapTexture1;                
            } else {
                pressureMapTexture = pressureMapTexture0;
            }
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER, //target specifying the binding point
                gl.COLOR_ATTACHMENT0,    //attaches the texture to the framebuffer's color buffer
                gl.TEXTURE_2D,  //its a 2D image
                pressureMapTexture,   //object whose image to attach
                0   //specify the mipmap level
            );
            gl.uniform1i(pressureMapLocation_programPressureMap, i % 2 + 4);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }







        // update velocity map by subtracting the pressure gradient from velocity
        gl.useProgram(programVelocityMap);
        gl.vertexAttribPointer(
            positionLocation_programVelocityMap, // Attribute location
            2,  // Number of elements per attribute
            gl.FLOAT,   // Type of elements
            gl.FALSE,   // are elements normalized
            2 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
            0   // Offset from the beginning of a single vertex to this attribute
        );
        gl.enableVertexAttribArray(positionLocation_programVelocityMap);

        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferVelocity);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, //target specifying the binding point
            gl.COLOR_ATTACHMENT0,    //attaches the texture to the framebuffer's color buffer
            gl.TEXTURE_2D,  //its a 2D image
            velocityMapTexture0,   //object whose image to attach
            0   //specify the mipmap level
        );
        gl.uniform2f(canvasResolutionLocation_programVelocityMap, canvas.width, canvas.height);
        gl.uniform1i(velocityMapLocation_programVelocityMap, 3); // reading from velocity map texture 1
        gl.uniform1i(pressureMapLocation_programVelocityMap, jacobi_iteration % 2 + 4);
        gl.uniform2f(epsilonLocation_programVelocityMap, epsilonX, epsilonY);
        gl.uniform1f(densityLocation_programVelocityMap, density);
        gl.uniform1f(dtLocation_programVelocityMap, dt);
        gl.drawArrays(gl.TRIANGLES, 0, 6);








        // color advection to display to canvas
        gl.useProgram(programColorMap);
        gl.vertexAttribPointer(
            positionLocation_programColorMap, // Attribute location
            2,  // Number of elements per attribute
            gl.FLOAT,   // Type of elements
            gl.FALSE,   // are elements normalized
            2 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
            0   // Offset from the beginning of a single vertex to this attribute
        );
        gl.enableVertexAttribArray(positionLocation_programColorMap);

        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferColor);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, //target specifying the binding point
            gl.COLOR_ATTACHMENT0,    //attaches the texture to the framebuffer's color buffer
            gl.TEXTURE_2D,  //its a 2D image
            colorMapTexture,   //object whose image to attach
            0   //specify the mipmap level
        );
        gl.uniform1f(dtLocation_programColorMap, dt);
        gl.uniform1i(velocityMapLocation_programColorMap, 2);   // reading velocity map texture 0
        gl.uniform1i(colorMapLocation_programColorMap, renderToTexture0);
        gl.uniform1i(pressureMapLocation_programColorMap, jacobi_iteration % 2 + 4);
        gl.uniform1i(divergenceMapLocation_programColorMap, 6);
        gl.uniform2f(canvasResolutionLocation_programColorMap, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // write to canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.uniform1i(colorMapLocation_programColorMap, !renderToTexture0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        renderToTexture0 = !renderToTexture0;
        requestAnimationFrame(loop);
    };
    
    var renderToTexture0 = false;
    requestAnimationFrame(loop);
}

function bindFramebufferAndSetViewport(fb, width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, width, height);
}


// Mouse event listener source code adapted from: https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element/18053642#18053642
function getCursorPosition(canvas, event) {
    console.log('x: ' + event.clientX + "; y: " + event.clientY);
    return {
        xPos: event.clientX,
        yPos: event.ClientY,
    };
}