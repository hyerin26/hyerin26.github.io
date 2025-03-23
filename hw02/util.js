// resizeAspectRatio() 함수 구현
export function resizeAspectRatio(canvas, gl) {
    let size;
    if (window.innerWidth < window.innerHeight) { 
        size = window.innerWidth;
    }
    else {
        size = window.innerHeight;
    }
    canvas.width = size;
    canvas.height = size;
    gl.viewport(0, 0, size, size);
}