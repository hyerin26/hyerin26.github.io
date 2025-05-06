// Cone.js

export class Cone {
    constructor(gl, segments = 32, radius = 0.5, height = 1.0) {
        this.gl = gl;
        this.segments = segments;
        this.radius = radius;
        this.height = height;

        this.apex = [0, height / 2, 0];
        this.baseY = -height / 2;

        // storage
        this.vertices = [];
        this.normals = [];
        this.colors = [];
        this.texCoords = [];
        this.indices = [];

        this.useIndices = true; // true for smooth, false for flat

        this.faceNormals = [];
        this.vertexNormals = [];

        // default mode: smooth
        this.buildGeometrySmooth();
        this.initBuffers();
    }

    // ===============================
    // === Geometry for SMOOTH mode ===
    // ===============================
    buildGeometrySmooth() {
        const thetaStep = (2 * Math.PI) / this.segments;

        this.vertices = [];
        this.colors = [];
        this.texCoords = [];
        this.indices = [];

        // apex
        this.vertices.push(...this.apex);
        this.colors.push(1, 1, 1, 1);
        this.texCoords.push(0.5, 1.0);

        // base vertices
        for (let i = 0; i < this.segments; i++) {
            const theta = i * thetaStep;
            const x = this.radius * Math.cos(theta);
            const z = this.radius * Math.sin(theta);
            this.vertices.push(x, this.baseY, z);
            this.colors.push(1, 1, 1, 1);
            this.texCoords.push((Math.cos(theta) + 1) / 2, (Math.sin(theta) + 1) / 2);
        }

        // indices
        for (let i = 0; i < this.segments; i++) {
            const apex = 0;
            const b1 = i + 1;
            const b2 = (i + 1) % this.segments + 1;
            this.indices.push(apex, b1, b2);
        }

        // generate normals
        this.computeVertexNormals();
        this.normals = this.vertexNormals;
        this.useIndices = true;
    }

    computeVertexNormals() {
        const normalSum = new Float32Array(this.vertices.length);
        const count = new Uint32Array(this.vertices.length / 3);

        for (let i = 0; i < this.indices.length; i += 3) {
            const i0 = this.indices[i], i1 = this.indices[i + 1], i2 = this.indices[i + 2];

            const v0 = this.vertices.slice(i0 * 3, i0 * 3 + 3);
            const v1 = this.vertices.slice(i1 * 3, i1 * 3 + 3);
            const v2 = this.vertices.slice(i2 * 3, i2 * 3 + 3);

            const u = vec3.create(), v = vec3.create(), n = vec3.create();
            vec3.subtract(u, v1, v0);
            vec3.subtract(v, v2, v0);
            vec3.cross(n, v, u);
            vec3.normalize(n, n);

            for (let idx of [i0, i1, i2]) {
                normalSum[idx * 3 + 0] += n[0];
                normalSum[idx * 3 + 1] += n[1];
                normalSum[idx * 3 + 2] += n[2];
                count[idx]++;
            }
        }

        this.vertexNormals = new Float32Array(this.vertices.length);
        for (let i = 0; i < count.length; i++) {
            if (count[i] > 0) {
                const n = vec3.fromValues(
                    normalSum[i * 3],
                    normalSum[i * 3 + 1],
                    normalSum[i * 3 + 2]
                );
                vec3.normalize(n, n);
                this.vertexNormals.set(n, i * 3);
            }
        }
    }

    // ===============================
    // === Geometry for FLAT mode ===
    // ===============================
    buildGeometryFlat() {
        const thetaStep = (2 * Math.PI) / this.segments;

        this.vertices = [];
        this.normals = [];
        this.colors = [];
        this.texCoords = [];
        this.indices = [];

        for (let i = 0; i < this.segments; i++) {
            const theta1 = i * thetaStep;
            const theta2 = (i + 1) * thetaStep;

            const apex = [0, this.height / 2, 0];
            const base1 = [this.radius * Math.cos(theta1), this.baseY, this.radius * Math.sin(theta1)];
            const base2 = [this.radius * Math.cos(theta2), this.baseY, this.radius * Math.sin(theta2)];

            const u = vec3.create(), v = vec3.create(), n = vec3.create();
            vec3.subtract(u, base1, apex);
            vec3.subtract(v, base2, apex);
            vec3.cross(n, v, u);
            vec3.normalize(n, n);

            for (let pos of [apex, base1, base2]) {
                this.vertices.push(...pos);
                this.normals.push(...n);
                this.colors.push(1, 1, 1, 1);
                this.texCoords.push(0.5, 0.5);
            }
        }

        this.useIndices = false;
    }

    initBuffers() {
        const gl = this.gl;

        const pos = new Float32Array(this.vertices);
        const nor = new Float32Array(this.normals);
        const col = new Float32Array(this.colors);
        const tex = new Float32Array(this.texCoords);

        const vSize = pos.byteLength;
        const nSize = nor.byteLength;
        const cSize = col.byteLength;
        const tSize = tex.byteLength;

        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

        gl.bufferData(gl.ARRAY_BUFFER, vSize + nSize + cSize + tSize, gl.STATIC_DRAW);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, nor);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize, col);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize + cSize, tex);

        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, vSize + nSize);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, vSize + nSize + cSize);

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);

        if (this.useIndices) {
            this.ebo = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), gl.STATIC_DRAW);
        }

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    updateBuffers() {
        this.initBuffers(); // Re-upload everything
    }

    useFlatShading() {
        this.buildGeometryFlat();
        this.updateBuffers();
    }

    useSmoothShading() {
        this.buildGeometrySmooth();
        this.updateBuffers();
    }

    draw(shader) {
        const gl = this.gl;
        shader.use();
        gl.bindVertexArray(this.vao);

        if (this.useIndices) {
            gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawArrays(gl.TRIANGLES, 0, this.vertices.length / 3);
        }

        gl.bindVertexArray(null);
    }

    delete() {
        const gl = this.gl;
        gl.deleteBuffer(this.vbo);
        if (this.ebo) gl.deleteBuffer(this.ebo);
        gl.deleteVertexArray(this.vao);
    }
}
