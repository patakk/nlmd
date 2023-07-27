
import {getShaderSource, createShader, createProgram} from "./webglutils.js";
import { Vector, Quad, noiseSeed, noise } from "./utils.js";
import { makeBlueNoiseImage, poissonDiskSampling } from "./poisson.js"; 

let canvas;
let gl;

let curves = [];
let quads = [];
let uvs = [];
let infos = [];
let angles = [];
let diffuse1 = [];
let diffuse2 = [];
let diffuse3 = [];

let aspects = [
    3/4,
    4/3,
    1/1,
]

let SCALE;
let ASPECT;
let EDGE_OFFSET;
let THICKNESS;
let VERSION;
let POSTPROC = 1;

let DIM = 2000;
let REN = window.innerHeight*2;
if(search.has('size')){
    REN = parseInt(search.get('size'));
}
let DEBUG = false;
if(search.has('debug')){
    if(search.get('debug') == 'true')
        DEBUG = true;
}


function main() {
    
    // updateURLParameter('hash', btoa(JSON.stringify({"hash": hash, "aspect": Math.round(aaspect*10000)/10000, 'version': vversion})).toString('base64'));

    noiseSeed(Math.floor(prng.rand()*10000));

    curves = [];
    quads = [];
    uvs = [];
    infos = [];
    angles = [];
    diffuse1 = [];
    diffuse2 = [];
    diffuse3 = [];
    
    SCALE = 1;
    //ASPECT = aspects[Math.floor(prng.rand()*aspects.length)];
    ASPECT = 3 / 4;
    VERSION = 0;

    EDGE_OFFSET = 50;
    if(ASPECT >= 1)
        EDGE_OFFSET = window.innerHeight*.1;
    THICKNESS = 70 * SCALE;
    THICKNESS = rand(66, 77) * SCALE;
    THICKNESS = rand(20, 40) * SCALE;
    THICKNESS = rand(40, 50) * SCALE;

    if(!canvas)
        canvas = document.getElementById("canvas");
    onresize(null);
    if(!gl)
        gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true, antialias: true, depth: true});

    gl.canvas.width = REN;
    gl.canvas.height = Math.round(REN/ASPECT);

    gl.viewport(0, 0, REN, Math.round(REN/ASPECT));

    // setupCurves(options);
    // if(DEBUG) previewCurves()
    // constructQuads();
    constructQuads();

    render();
}

function previewCurves(){
    let debugcanvas = document.getElementById("debugcanvas");
    debugcanvas.width = REN;
    debugcanvas.height = Math.round(REN/ASPECT);
    
    debugcanvas.style.width = 500 + "px";
    debugcanvas.style.height = Math.round(500/ASPECT) + "px";;
    let ctx = debugcanvas.getContext('2d');
    ctx.clearRect(0, 0, debugcanvas.width, debugcanvas.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, debugcanvas.width, debugcanvas.height);
    ctx.lineWidth = 44;
    ctx.fillStyle = "#ffffff";
    for(let i = 0; i < curves.length; i++){
        let points = curves[i];
        for(let j = 0; j < points.length-1; j++){
            let pt1 = points[j];
            let pt2 = points[j+1];
            let parts = 20;
            for(let k = 0; k < parts; k++){
                let t = k/parts;
                let x = t*pt1.x + (1-t)*pt2.x;
                let y = t*pt1.y + (1-t)*pt2.y;
                y = debugcanvas.height - y*1;
                ctx.fillRect(x*1-33/2, y-33/2, 33, 33);
            }
        }
    }
    
}

function getRandomTexture(){
    var width = 1024;
    var height = 1024;

    // Create a new Uint8Array to hold the pixel data for the texture.
    // Each pixel needs 4 bytes (for RGBA), so multiply the width and height by 4.
    var data = new Uint8Array(width * height * 4);

    // Fill the array with random values.
    for (var i = 0; i < data.length; i++) {
        // Multiply by 256 to get a value in the range [0, 256), then use Math.floor to round down to an integer.
        // data[i] = Math.floor(prng.rand() * 256);
        data[i] = Math.floor(prng.rand() * 256);
    }

    // Create the texture.
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return texture;
}

function getBlueNoiseTexture() {
    // Generate the blue noise image
    const blueNoiseImage = makeBlueNoiseImage(256, 256, 1.5);
    const ctx = blueNoiseImage.getContext('2d');

    // Get the image data from the canvas
    const imageData = ctx.getImageData(0, 0, blueNoiseImage.width, blueNoiseImage.height);
    const data = new Uint8Array(imageData.data.buffer);

    // Create a new texture
    const blueNoiseTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blueNoiseTexture);

    // Set the parameters so we can render any size image
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Upload the image data into the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, blueNoiseImage.width, blueNoiseImage.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

    return blueNoiseTexture;
}

function createAndSetupBuffer(gl, data, attributeLocation, size) {
    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attributeLocation);
    gl.vertexAttribPointer(attributeLocation, size, gl.FLOAT, false, 0, 0);
    return buffer;
}

let blueNoiseTexture;
let doPostProcessing = true;
let averagepos = new Vector(0, 0);

function render(){
    let fragmentCode = getShaderSource("frag.glsl");
    let vertexCode = getShaderSource("vert.glsl");

    let vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexCode);
    let fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentCode);

    let program = createProgram(gl, vertexShader, fragmentShader);

    gl.useProgram(program);
    gl.lineWidth(11);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // gl.enable(gl.DEPTH_TEST);

    let simulationUniformLocation = gl.getUniformLocation(program, "u_simulation");
    let resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    let seedUniformLocation = gl.getUniformLocation(program, "u_seed");
    let versionUniformLocation = gl.getUniformLocation(program, "u_version");

    gl.uniform2f(resolutionUniformLocation, REN, Math.round(REN/ASPECT));
    gl.uniform2f(simulationUniformLocation, DIM, Math.round(DIM/ASPECT));
    
    let randomtexture = getRandomTexture();

    let seedr = prng.rand();
    let seedg = prng.rand();
    let seedb = prng.rand();

    gl.uniform3f(seedUniformLocation, seedr, seedg, seedb);
    gl.uniform1f(versionUniformLocation, VERSION);

    let _buf1 = createAndSetupBuffer(gl, quads,        gl.getAttribLocation(program, "a_position"), 3);
    let _buf2 = createAndSetupBuffer(gl, uvs,          gl.getAttribLocation(program, "a_uv"), 2);
    let _buf3 = createAndSetupBuffer(gl, infos,        gl.getAttribLocation(program, "a_info"), 1);
    let _buf4 = createAndSetupBuffer(gl, angles,       gl.getAttribLocation(program, "a_angle"), 1);
    let _buf5 = createAndSetupBuffer(gl, diffuse1, gl.getAttribLocation(program, "a_diffuse1"), 3);
    let _buf6 = createAndSetupBuffer(gl, diffuse2, gl.getAttribLocation(program, "a_diffuse2"), 3);
    let _buf7 = createAndSetupBuffer(gl, diffuse3, gl.getAttribLocation(program, "a_diffuse3"), 3);


    let framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    let depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, REN, Math.round(REN / ASPECT));
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, REN, Math.round(REN/ASPECT), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    
    // Attach the texture to the framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    
    // Check the framebuffer is complete
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('Error setting up framebuffer');
    }

    gl.activeTexture(gl.TEXTURE0 + 0);
    gl.bindTexture(gl.TEXTURE_2D, randomtexture);
    gl.uniform1i(gl.getUniformLocation(program, "u_randomTexture"), 0);
    gl.uniform2f(gl.getUniformLocation(program, "u_randomTextureSize"), 256, 256);
    gl.uniform1f(gl.getUniformLocation(program, "u_postproc"), POSTPROC);
    gl.uniform2f(gl.getUniformLocation(program, "u_averagepos"), averagepos.x, averagepos.y);

    gl.clearColor(0.898, 0.827, 0.675, 1);
    gl.clearColor(rand(.9, .93), rand(.9, .92), rand(.89, .91), 1);
    gl.clearColor(rand(.3, .9), rand(.3, .9), rand(.3, .9), 1);
    gl.clearColor(0.04, 0.05, 0.05, 1);
    let ooffb = rand(-.01, .01)
    let br = rand(.9, .93) + ooffb;
    let bg = rand(.9, .92) + ooffb;
    let bb = rand(.89, .91) + ooffb;
    while(bg > br){
        br = rand(.9, .93) + ooffb;
        bg = rand(.9, .92) + ooffb;
        bb = rand(.89, .91) + ooffb;
    }
    gl.clearColor(br, bg, bb, 1);
    if(vversion == 3 || vversion == 4 || vversion == 5){
        let aq = rand(.87, .93);
        gl.clearColor(aq, aq, aq, 1);
    }
    gl.clearColor(0.9254902, 0.87156863, 0.84588235, 1.);

    let chc = Math.floor(rand(0, 3));
    if(chc == 0){
        gl.clearColor(0.1254902, 0.12156863, 0.10588235, 1.);
    }
    else if(chc == 1){
        gl.clearColor(0.9254902, 0.91156863, 0.91588235, 1.);
    }
    else if(chc == 2){
        gl.clearColor(0.1254902, 0.11156863, 0.11588235, 1.);
        // gl.clearColor(1. - 0.9, 1. - 0.75, 1. - 0.64, 1.);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let numQuads = quads.length / 8;
    let numInfos = infos.length / 12;
    let curve = curves[0];
    for(let i = 0; i < numQuads; i++) {
        const offset = i * 4; // 4 vertices per quad
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, 4);
    }

    // Create a new framebuffer to resolve multisampling into
    // let resolveFramebuffer = gl.createFramebuffer();
    // gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFramebuffer);
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // Blit the multisampled renderbuffer to the texture
    // gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
    // gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolveFramebuffer);
    // gl.blitFramebuffer(
    //     0, 0, 100, Math.round(100/ASPECT),  // src rectangle
    //     0, 0, 100, Math.round(100/ASPECT),  // dst rectangle
    //     gl.COLOR_BUFFER_BIT,  // buffer mask
    //     gl.LINEAR  // interpolation
    // );

    
    const quadVertices = [
        -1, -1,
         1, -1,
        -1,  1,
         1,  1
    ];

    let bgFragmentCode = getShaderSource("bgfrag.glsl");
    let bgVertexCode = getShaderSource("bgvert.glsl");

    let bgVertexShader = createShader(gl, gl.VERTEX_SHADER, bgVertexCode);
    let bgFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, bgFragmentCode);

    let bgProgram = createProgram(gl, bgVertexShader, bgFragmentShader);

    gl.useProgram(bgProgram);
    let backgroundPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadVertices), gl.STATIC_DRAW);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);  // unbind the framebuffer

    let bgPositionAttributeLocation = gl.getAttribLocation(bgProgram, "a_position");
    let uTextureUniformLocation = gl.getUniformLocation(bgProgram, "u_texture");

    gl.activeTexture(gl.TEXTURE0+0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uTextureUniformLocation, 0);
    gl.uniform2f(gl.getUniformLocation(bgProgram, "u_resolution"), REN, Math.round(REN/ASPECT));
    gl.uniform3f(gl.getUniformLocation(bgProgram, "u_seed"), prng.rand(), prng.rand(), prng.rand());
    gl.uniform1f(gl.getUniformLocation(bgProgram, "u_postproc"), POSTPROC);
    gl.uniform3f(gl.getUniformLocation(bgProgram, "u_margincolor"), 0.15, 0.15, 0.15);


    let bgPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bgPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadVertices), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(bgPositionAttributeLocation);
    gl.vertexAttribPointer(
        bgPositionAttributeLocation,
        2,         
        gl.FLOAT,   
        false,     
        0,         
        0         
    );

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}


let red = [1., 0., 0.];
let green = [0., 1., 0.];
let blue = [0., 0., 1.];
let black = [0., 0., 0.];

function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
}

function constructQuads() {


    let aaa = DIM;
    let bbb = Math.floor(DIM / ASPECT);
    let margin = aaa * .07;

    let nx = 60
    let ny = 100
    let stripeThickness = (aaa + bbb) / 2 / (nx + ny) * 2 * .48;

    let maxang = rand(0.0015, 0.03);
    let modoff = Math.floor(rand(0, 100));

    red = [rand(0.5, 1.), rand(0., .5), rand(0., .5)];
    green = [rand(0., .5), rand(0.5, 1.), rand(0., .5)];
    blue = [rand(0., .5), rand(0., .5), rand(0.5, 1.)];

    let sshfx = rand(-stripeThickness, stripeThickness);

    let movingcenter = new Vector(aaa / 2, bbb / 2);
    let movingradius = 200;
    let movingstartangle = rand(0, 2 * Math.PI);
    let movinganglediff = 2*Math.PI*.1;

    let palette = [
        [rand(0.7,1), rand(0,.2), rand(0,.2)],
        [rand(0.,.2), rand(0.,.2), rand(0.7,1)],
        [rand(0.7,1), rand(0.7,1), rand(0,.2)],
        [rand(0.7,1), rand(0.7,1), rand(0,.2)],
        [0, 0, 0]
    ]

    let ccolor = palette[Math.floor(rand(0, palette.length))];

    let coco = 0;
    let white = rand(0.2, .8);
    let orange = [rand(0.5, 1.), rand(0.2, .5), rand(0., .5)];
    let walks = 500;
    let minx = 100000;
    let maxx = -100000;
    let miny = 100000;
    let maxy = -100000;
    for(let i = 0; i < walks; i++) {
        movingcenter.x = aaa/2+aaa/2 * (-.5 + power(noise(i*0.03, 12.31), 4));
        movingcenter.y = bbb/2+bbb/2 * (-.5 + power(noise(i*0.03, 331.58), 4));
        movingradius = 100 + 700*power(noise(i*0.05, 667.98), 2);
        movinganglediff = 2*Math.PI*.1 + 2*Math.PI*.1*power(noise(i*0.05, 531.38), 2);
        movingstartangle += Math.PI*.014*power(noise(i*0.0001, 917.48), 2);

        for(let iter = 0; iter < 55; iter++) {
            let angle = movingstartangle + movinganglediff * Math.sin(iter*0.8 + rand(-.3,.3));

            let nzx = 1 + .3*(-.5 + power(noise(iter*0.003, 152.31+i*31.), 4));
            let nzy = 1 + .3*(-.5 + power(noise(iter*0.003, 3331.58+i*31.), 4));

            let pos = movingcenter.clone().add(new Vector(Math.cos(angle)*.5, Math.sin(angle)).scale(movingradius));

            if(noise(coco*0.01) < .3){
                angle = 0;
            }

            let le = 6.8;
            let lo = rand(16, 24) * .2 * (1.6 + .6 * Math.sin(iter * 0.8))*4.;
            let p1 = new Vector(pos.x - lo, pos.y - lo * le);
            let p2 = new Vector(pos.x + lo, pos.y - lo * le);
            let p3 = new Vector(pos.x - lo, pos.y + lo * le);
            let p4 = new Vector(pos.x + lo, pos.y + lo * le);

            let midpoint = p1.clone().add(p2).add(p3).add(p4).scale(0.25);

            let quad = new Quad(p1, p2, p3, p4);
            quad.rotateOff(angle + rand(-.1,.3), midpoint);

            let c1 = [rand(.8,1), 0, 0];
            let c2 = [rand(0,1), map(i,0,walks,0.1,.3), 0]; // used for fbm3
            let c3 = [0, 0, rand(.8,1)];

            if(rand(0,1) < .01) {
                ccolor = palette[Math.floor(rand(0, palette.length))];
            }


            c1[0] = clamp(ccolor[0] + 5*rand(-.15,.15), 0, 1);
            c1[1] = clamp(ccolor[1] + 5*rand(-.15,.15), 0, 1);
            c1[2] = clamp(ccolor[2] + 5*rand(-.15,.15), 0, 1);

            let whiteamp = .25 + .25*Math.sin(iter * 0.8);
            c1[0] = c1[0] * (1 - whiteamp) + whiteamp * white;
            c1[1] = c1[1] * (1 - whiteamp) + whiteamp * white;
            c1[2] = c1[2] * (1 - whiteamp) + whiteamp * white;

            let hohoamp = 1-map(i, 0, walks, 0, 1);

            c1[0] = c1[0] * (1 - hohoamp) + hohoamp * orange[0];
            c1[1] = c1[1] * (1 - hohoamp) + hohoamp * orange[1];
            c1[2] = c1[2] * (1 - hohoamp) + hohoamp * orange[2];

            
            minx = Math.min(minx, p1.x, p2.x, p3.x, p4.x);
            maxx = Math.max(maxx, p1.x, p2.x, p3.x, p4.x);
            miny = Math.min(miny, p1.y, p2.y, p3.y, p4.y);
            maxy = Math.max(maxy, p1.y, p2.y, p3.y, p4.y);

            addquadpointstoattributes(quad.p1, quad.p2, quad.p3, quad.p4, [0, 0], [1, 0], [0, 1], [1, 1], coco++, quad.p1.clone(), 0, c1, c2, c3);

         }
    }
    averagepos.x = (minx + maxx)/2;
    averagepos.y = (miny + maxy)/2;
    averagepos.x = aaa/2 - averagepos.x;
    averagepos.y = bbb/2 - averagepos.y;
    console.log(averagepos)


    console.log('total', coco);
// addquadpointstoattributes(p1, p2, p3, p4, [0, 0], [1, 0], [0, 1], [1, 1], 0, p1.clone(), 0, [1, 0, 0]);


    quads = new Float32Array(quads);
    uvs = new Float32Array(uvs);
    infos = new Float32Array(infos);
    angles = new Float32Array(angles);
    diffuse1 = new Float32Array(diffuse1);
    diffuse2 = new Float32Array(diffuse2);
    diffuse3 = new Float32Array(diffuse3);
    console.log('baj')
}

// class Quad {
//     constructor(p1, p2, p3, p4, uv1 = [0, 0], uv2 = [1, 0], uv3 = [0, 1], uv4 = [1, 1], index = 0, offset_0 = new Vector(0, 0), angle_0 = 0, color1 = [1, 0, 0], color2 = [0, 1, 0], color3 = [0, 0, 1]) {
//         this.p1 = p1;
//         this.p2 = p2;
//         this.p3 = p3;
//         this.p4 = p4;
//         this.uv1 = uv1;
//         this.uv2 = uv2;
//         this.uv3 = uv3;
//         this.uv4 = uv4;
//         this.index = index;
//         this.offset_0 = offset_0;
//         this.angle_0 = angle_0;
//         this.color1 = color1;
//         this.color2 = color2;
//         this.color3 = color3;
//     }
// }



function addquadpointstoattributes(p1, p2, p3, p4, uv1 = [0, 0], uv2 = [1, 0], uv3 = [0, 1], uv4 = [1, 1], index = 0, offset_0 = new Vector(0, 0), angle_0 = 0, color1 = [1, 0, 0], color2 = [0, 1, 0], color3 = [0, 0, 1]){
    quads.push(p1.x); quads.push(p1.y); quads.push(p1.z);
    quads.push(p2.x); quads.push(p2.y); quads.push(p2.z);
    quads.push(p3.x); quads.push(p3.y); quads.push(p3.z);
    quads.push(p4.x); quads.push(p4.y); quads.push(p4.z);
    uv1 = new Vector(uv1[0], uv1[1]);
    uv2 = new Vector(uv2[0], uv2[1]);
    uv3 = new Vector(uv3[0], uv3[1]);
    uv4 = new Vector(uv4[0], uv4[1]);

    let maxscale = 3/Math.max(DIM, DIM/ASPECT);
    // uv1 = p1.clone().sub(offset_0).rotate(-angle_0).multiplyScalar(maxscale);
    // uv2 = p2.clone().sub(offset_0).rotate(-angle_0).multiplyScalar(maxscale);
    // uv3 = p3.clone().sub(offset_0).rotate(-angle_0).multiplyScalar(maxscale);
    // uv4 = p4.clone().sub(offset_0).rotate(-angle_0).multiplyScalar(maxscale);

    let d1 = Math.sqrt(Math.pow(p1.x - p3.x, 2) + Math.pow(p1.y - p3.y, 2));
    let d2 = Math.sqrt(Math.pow(p2.x - p4.x, 2) + Math.pow(p2.y - p4.y, 2));
    let d3 = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    let ratio = d1/d3;
    uvs.push(uv1.x); uvs.push(uv1.y);
    uvs.push(uv2.x); uvs.push(uv2.y);
    uvs.push(uv3.x); uvs.push(uv3.y);
    uvs.push(uv4.x); uvs.push(uv4.y);
    infos.push(index); infos.push(index); infos.push(index); infos.push(index);
    angles.push(angle_0); angles.push(angle_0); angles.push(angle_0); angles.push(angle_0);
    diffuse1.push(color1[0]); diffuse1.push(color1[1]); diffuse1.push(color1[2]);
    diffuse1.push(color1[0]); diffuse1.push(color1[1]); diffuse1.push(color1[2]);
    diffuse1.push(color1[0]); diffuse1.push(color1[1]); diffuse1.push(color1[2]);
    diffuse1.push(color1[0]); diffuse1.push(color1[1]); diffuse1.push(color1[2]);
    diffuse2.push(color2[0]); diffuse2.push(color2[1]); diffuse2.push(color2[2]);
    diffuse2.push(color2[0]); diffuse2.push(color2[1]); diffuse2.push(color2[2]);
    diffuse2.push(color2[0]); diffuse2.push(color2[1]); diffuse2.push(color2[2]);
    diffuse2.push(color2[0]); diffuse2.push(color2[1]); diffuse2.push(color2[2]);
    diffuse3.push(color3[0]); diffuse3.push(color3[1]); diffuse3.push(color3[2]);
    diffuse3.push(color3[0]); diffuse3.push(color3[1]); diffuse3.push(color3[2]);
    diffuse3.push(color3[0]); diffuse3.push(color3[1]); diffuse3.push(color3[2]);
    diffuse3.push(color3[0]); diffuse3.push(color3[1]); diffuse3.push(color3[2]);
}

function rand(a, b){
    return a + prng.rand()*(b-a);
}

function map(value, min1, max1, min2, max2){
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

function resample(curve){
    let newCurve = [];
    for(let i = 0; i < curve.length-1; i++){
        let p1 = curve[i];
        let p2 = curve[i+1];
        let d = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        let num = Math.round(d/THICKNESS)+1;
        for(let j = 0; j < num; j++){
            let t = j/num;
            let x = p1.x + t*(p2.x - p1.x);
            let y = p1.y + t*(p2.y - p1.y);
            newCurve.push(new Vector(x, y));
        }
    }
    newCurve.push(curve[curve.length-1]);
    return newCurve;
}

function intersects(point, curve){
    if(curve.length < 2)
        return false;
    let resampled = resample(curve);

    for(let i = 0; i < resampled.length; i++){
        let d = point.distance(resampled[i]);
        if(d < THICKNESS*2)
            return true;
    }
    return false;
}

function setupCurves(options){

    let success = false;
    let ctries = 0;
    let curve = [];
    let pathsteps = Math.round(rand(4, 6))*2;

    let aaa = DIM;
    let bbb = Math.floor(DIM/ASPECT);
    let margin = aaa*.12;
    let numangles = 114;

    while(!success && ctries++ < 100){
        let pos = new Vector(aaa/2 + rand(-222, 222), bbb/2 + rand(-222, 222));
        let direction0 = new Vector(rand(-1, 1), rand(-1, 1));
        direction0.normalize();

        curve = [];
        let center = new Vector(aaa*.5, bbb*.5);

        curve.push(pos);
        let prevangle = 100000;
        for(let i = 0; i < pathsteps; i++){
            let direction = direction0.clone();
            direction.rotate(map(power(rand(0, 1), 3), 0, 1, Math.PI/2, Math.PI*3/2));
            let hhding = direction.heading();
            hhding = Math.round(hhding/(Math.PI/numangles))*(Math.PI/numangles);
            direction = new Vector(Math.cos(hhding), Math.sin(hhding));
            direction.normalize();
            direction.multiplyScalar(SCALE*rand(100, 366));
            // if(i%2 == 0){
            //     direction.multiplyScalar(SCALE*rand(100, 110));
            // }
            // else{
            //     direction.multiplyScalar(SCALE*rand(360, 370));
            // }
            direction.multiplyScalar(SCALE*rand(100, 366));
            let newPos = new Vector(pos.x + direction.x, pos.y + direction.y);
            let tries = 0;
            while(tries++ < 130 && (newPos.x < margin || newPos.x > aaa-margin || newPos.y < margin || newPos.y > bbb-margin || intersects(newPos, curve))){
                direction = direction0.clone();
                direction.rotate(map(power(rand(0, 1), 3), 0, 1, Math.PI/2, Math.PI*3/2));
                hhding = direction.heading();
                hhding = Math.round(hhding/(Math.PI/numangles))*(Math.PI/numangles);
                direction = new Vector(Math.cos(hhding), Math.sin(hhding));
                direction.normalize();
                direction.multiplyScalar(SCALE*rand(100, 366));
                // if(i%2 == 0){
                //     direction.multiplyScalar(SCALE*rand(100, 110));
                // }
                // else{
                //     direction.multiplyScalar(SCALE*rand(360, 370));
                // }
                newPos = new Vector(pos.x + direction.x, pos.y + direction.y);
            }
            prevangle = hhding;
            direction0 = direction.clone();
            pos = newPos;
            curve.push(newPos);
        }
        let width = 0;
        let height = 0;
        let maxwidth = aaa-margin*2;
        let maxheight = bbb-margin*2;
        let minx = 999999;
        let maxx = -999999;
        let miny = 999999;
        let maxy = -999999;
        for(let i = 0; i < curve.length; i++){
            let p = curve[i];
            if(p.x < minx) minx = p.x;
            if(p.x > maxx) maxx = p.x;
            if(p.y < miny) miny = p.y;
            if(p.y > maxy) maxy = p.y;
        }
        let middle = new Vector((minx+maxx)/2, (miny+maxy)/2);
        width = maxx - minx;
        height = maxy - miny;
        let scx = width/maxwidth;
        let scy = height/maxheight;
        let sc = Math.max(scx, scy);

        // let sumpoints = new Vector(0, 0);
        // for(let i = 0; i < curve.length; i++){
        //     sumpoints.add(curve[i]);
        // }
        // sumpoints.multiplyScalar(1/curve.length);

        for(let i = 0; i < curve.length; i++){
            curve[i].sub(middle);
        }
        if(sc > 1 || true){
            for(let i = 0; i < curve.length; i++){
                curve[i].x /= scx;
                curve[i].y /= scy;
            }
        }
        for(let i = 0; i < curve.length; i++){
            curve[i].add(center);
        }

        success = true;
        for(let i = 0; i < curve.length; i++){
            let newPos = curve[i];
            if(newPos.x < margin || newPos.x > aaa-margin || newPos.y < margin || newPos.y > bbb-margin){
                success = false;
                break;
            }
        }
        for(let i = 0; i < curve.length; i++){
            // curve[i].add(new Vector(0, -bbb*random(-.1,.5)));
        }
    }
    // console.log(ctries)
    const roundq = vectors => vectors.map(q => 
        new Vector(Math.round(q.x/555)*555, Math.round(q.y/555)*555)
    );

    // curve = roundq(curve);

    curves.push(curve);
}

function hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f*s);
    let t = v * (1 - (1 - f) * s);
    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [Math.floor(r*255), Math.floor(g*255), Math.floor(b*255)];
}

function power(p, g) {
    if (p < 0.5)
        return 0.5 * Math.pow(2*p, g);
    else
        return 1 - 0.5 * Math.pow(2*(1 - p), g);
}

// on load html, no jquery
window.onload = main;
window.addEventListener('resize', onresize, false);

function randomizeState(){
    hash = (Math.random() + 1).toString(16).substring(2);
    editionNumber = p.editionNumber || 0;

    Random=function(n){var r,$,t,u,_=function n(r){for(var $=0,t=1779033703^r.length;$<r.length;$++)t=(t=Math.imul(t^r.charCodeAt($),3432918353))<<13|t>>>19;return function(){return t=Math.imul((t=Math.imul(t^t>>>16,2246822507))^t>>>13,3266489909),(t^=t>>>16)>>>0}}(n),o={rand:(r=_(),$=_(),t=_(),u=_(),function(){t|=0;var n=((r|=0)+($|=0)|0)+(u|=0)|0;return u=u+1|0,r=$^$>>>9,$=t+(t<<3)|0,t=(t=t<<21|t>>>11)+n|0,(n>>>0)/4294967296}),randInt:function(n,r){return n+Math.floor((r-n)*o.rand())}};return o};
}

function initRandomState(){
    prng = Random(hash);
    random = prng.rand;
}

// handle keys
document.addEventListener('keydown', function(event) {

    if(event.key == 's') {
        save();
    }
    else if ('qat123456'.indexOf(event.key) !== -1) {
        if(event.key == '1') {
            vversion = 0;
        }
        if(event.key == '2') {
            vversion = 1;
        }
        if(event.key == '3') {
            vversion = 2;
        }
        if(event.key == '4') {
            vversion = 3;
        }
        if(event.key == '5') {
            vversion = 4;
        }
        if(event.key == '6') {
            vversion = 5;
        }
        if(event.key == 'a') {
            if(aaspect > 1)
                aaspect = 3/4;
            else
                aaspect = 4/3;
        }
        if(event.key == 't') {
            POSTPROC = !POSTPROC;
        }
        if ('q1234567'.indexOf(event.key) !== -1){
            randomizeState();
        }
        initRandomState();
        // updateURLParameter('hash', btoa(JSON.stringify({"hash": hash, "aspect": Math.round(aaspect*10000)/10000, 'version': vversion})).toString('base64'));
        main();
    }
});


function handleWindowSize(){
    let clientWidth = window.innerWidth;
    let clientHeight = window.innerHeight;
    let caspect = (clientWidth-EDGE_OFFSET*2)/(clientHeight-EDGE_OFFSET*2);
    let aspect = ASPECT;
    let sw, sh;
    if(caspect > aspect){
        sh = Math.round(clientHeight) - EDGE_OFFSET*2;
        sw = Math.round(sh * aspect);
    }else{
        sw = Math.round(clientWidth) - EDGE_OFFSET*2;
        sh = Math.round(sw / aspect);
    }
    // canvas.width = sw;
    // canvas.height = sh;
    canvas.style.width = sw + 'px';
    canvas.style.height = sh + 'px';
    canvas.style.position = 'absolute';
    canvas.style.left = clientWidth/2 - sw/2 + 'px';
    canvas.style.top = clientHeight/2 - sh/2 + 'px';
}

function onresize(event){
    // // set width and height, full screen
    // canvas.width = window.innerWidth*SCALE;
    // canvas.height = window.innerHeight*SCALE;
    // canvas.style.width = window.innerWidth + "px";
    // canvas.style.height = window.innerHeight + "px";
    handleWindowSize();
}


// handle mouse clicke
let ismousedown = false;
document.addEventListener('mousedown', function(event) {
    // console.log(event);
    ismousedown = true;
    if(DEBUG)
        handleZoom(event);
});

// mosue drag
document.addEventListener('mousemove', function(event) {
    // console.log(event);
    if(ismousedown){
        if(DEBUG)
            handleZoom(event);
    }
});

document.addEventListener('mouseup', function(event) {
    // console.log(event);
    ismousedown = false;
    handleWindowSize();
});


function handleZoom(event){
    let clientWidth = window.innerWidth;
    let clientHeight = window.innerHeight;
    let caspect = (clientWidth-EDGE_OFFSET*2)/(clientHeight-EDGE_OFFSET*2);
    let aspect = ASPECT;
    let sw, sh;
    if(caspect > aspect){
        sh = Math.round(clientHeight) - EDGE_OFFSET*2;
        sw = Math.round(sh * aspect);
    }else{
        sw = Math.round(clientWidth) - EDGE_OFFSET*2;
        sh = Math.round(sw / aspect);
    }
    // canvas.width = sw;
    // canvas.height = sh;
    let mousex = event.clientX;
    let mousey = event.clientY;
    // map mouse to canvas
    let cw = canvas.width*.77;
    let ch = canvas.height*.77;
    let px = map(mousex, 0, clientWidth, 0, 1);
    let py = map(mousey, 0, clientHeight, 0, 1);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.style.position = 'absolute';
    canvas.style.left = mousex - cw/2 - cw*(-.5 + px)*1.5 + 'px';
    canvas.style.top = mousey - ch/2 - ch*(-.5 + py)*1.5 + 'px';
}



function save(){
    console.log('preparing canvas for saving...');
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'render_' + btoa(JSON.stringify({"hash": hash,"aspect": Math.round(ASPECT*10000)/10000, 'version': VERSION})).toString('base64') + '.png';
    // link.href = imgElement.src;
    link.href = dataURL;
    link.click();
}