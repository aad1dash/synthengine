/**
 * First-person player controller with WASD + mouse look.
 * Uses PointerLock API for mouse capture.
 */
import * as THREE from 'three';

const MOVE_SPEED = 6;
const RUN_SPEED = 12;
const MOUSE_SENSITIVITY = 0.002;
const HEAD_BOB_SPEED = 10;
const HEAD_BOB_AMOUNT = 0.04;
const GRAVITY = 20;
const PLAYER_HEIGHT = 1.7;

export class PlayerController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.position = new THREE.Vector3(0, PLAYER_HEIGHT, 0);
    this.velocity = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isRunning = false;

    this.isLocked = false;
    this.inVoid = false; // floating in void sections
    this.headBobPhase = 0;
    this.verticalVelocity = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);

    this._setupListeners();
  }

  _setupListeners() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    document.exitPointerLock();
  }

  _onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.moveForward = true; break;
      case 'KeyS': case 'ArrowDown': this.moveBackward = true; break;
      case 'KeyA': case 'ArrowLeft': this.moveLeft = true; break;
      case 'KeyD': case 'ArrowRight': this.moveRight = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.isRunning = true; break;
      case 'Space':
        if (this.inVoid) this.verticalVelocity = 4;
        break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.moveForward = false; break;
      case 'KeyS': case 'ArrowDown': this.moveBackward = false; break;
      case 'KeyA': case 'ArrowLeft': this.moveLeft = false; break;
      case 'KeyD': case 'ArrowRight': this.moveRight = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.isRunning = false; break;
    }
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= e.movementX * MOUSE_SENSITIVITY;
    this.euler.x -= e.movementY * MOUSE_SENSITIVITY;
    this.euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  setPosition(x, y, z) {
    this.position.set(x, y || PLAYER_HEIGHT, z);
  }

  update(dt) {
    if (!this.isLocked) return;

    const speed = this.isRunning ? RUN_SPEED : MOVE_SPEED;
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    // Get camera forward/right in world space (ignore pitch for movement)
    forward.setFromMatrixColumn(this.camera.matrix, 0);
    forward.crossVectors(this.camera.up, forward);
    forward.y = 0;
    forward.normalize();

    right.setFromMatrixColumn(this.camera.matrix, 0);
    right.y = 0;
    right.normalize();

    if (this.moveForward) direction.add(forward);
    if (this.moveBackward) direction.sub(forward);
    if (this.moveLeft) direction.sub(right);
    if (this.moveRight) direction.add(right);

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    // Apply movement
    this.position.x += direction.x * speed * dt;
    this.position.z += direction.z * speed * dt;

    // Gravity / void floating
    if (this.inVoid) {
      this.position.y += this.verticalVelocity * dt;
      this.verticalVelocity *= 0.95; // damping
    } else {
      this.verticalVelocity -= GRAVITY * dt;
      this.position.y += this.verticalVelocity * dt;
      if (this.position.y < PLAYER_HEIGHT) {
        this.position.y = PLAYER_HEIGHT;
        this.verticalVelocity = 0;
      }
    }

    // Head bob when walking on ground
    const isMoving = direction.lengthSq() > 0 && !this.inVoid;
    if (isMoving) {
      this.headBobPhase += dt * HEAD_BOB_SPEED * (this.isRunning ? 1.4 : 1);
      const bob = Math.sin(this.headBobPhase) * HEAD_BOB_AMOUNT;
      this.camera.position.copy(this.position);
      this.camera.position.y += bob;
    } else {
      this.headBobPhase = 0;
      this.camera.position.copy(this.position);
    }
  }

  /** Get forward direction vector */
  getForward() {
    const fwd = new THREE.Vector3(0, 0, -1);
    fwd.applyQuaternion(this.camera.quaternion);
    return fwd;
  }

  /** Get up vector */
  getUp() {
    return this.camera.up.clone();
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }
}
