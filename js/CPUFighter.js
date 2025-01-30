class CPUFighter extends Fighter {
    constructor(scene, position, color) {
        super(scene, position, color);
        this.thinkingInterval = 50; // ms between AI decisions
        this.lastThinkTime = 0;
        this.targetPosition = null;
        this.state = 'chase'; // chase, attack, retreat
        
        // Attack ranges based on the base Fighter class
        this.attackRanges = {
            close: 1.4,  // For punches
            medium: 1.8, // For kicks
            far: 2.0    // For ultra hits
        };

        // Movement properties for smooth transitions
        this.currentVelocity = new THREE.Vector3();
        this.targetVelocity = new THREE.Vector3();
        this.acceleration = 0.01;
        this.maxSpeed = 0.1;
        this.minDistanceToTarget = 0.5;
        
        // Wandering behavior properties
        this.wanderAngle = 0;
        this.wanderRadius = 2;
        this.wanderDistance = 3;
        this.wanderJitter = 0.1;
        
        // Movement state
        this.isMoving = false;
        this.movementSmoothing = 0.1;
    }

    update() {
        super.update();
        
        // Don't think/attack if game is over
        if (game.isGameOver) return;
        
        const now = Date.now();
        if (now - this.lastThinkTime > this.thinkingInterval) {
            this.think();
            this.lastThinkTime = now;
        }

        // Update movement
        this.updateMovement();
    }

    updateMovement() {
        // Smoothly interpolate current velocity towards target velocity
        this.currentVelocity.lerp(this.targetVelocity, this.movementSmoothing);
        
        // Apply movement if velocity is significant
        if (this.currentVelocity.length() > 0.001) {
            this.isMoving = true;
            this.move({ 
                x: this.currentVelocity.x, 
                z: this.currentVelocity.z 
            });
        } else {
            this.isMoving = false;
        }

        // Natural deceleration
        this.targetVelocity.multiplyScalar(0.95);
    }

    moveTowardsPlayer(player) {
        const direction = new THREE.Vector3()
            .subVectors(player.mesh.position, this.mesh.position)
            .normalize();
        
        // Add some wandering behavior for more natural movement
        const wanderOffset = this.calculateWanderOffset();
        direction.add(wanderOffset);
        direction.normalize();
        
        // Set target velocity
        this.targetVelocity.set(
            direction.x * this.maxSpeed,
            0,
            direction.z * this.maxSpeed
        );
    }

    moveAwayFromPlayer(player) {
        const direction = new THREE.Vector3()
            .subVectors(this.mesh.position, player.mesh.position)
            .normalize();
        
        // Add some wandering behavior for more natural movement
        const wanderOffset = this.calculateWanderOffset();
        direction.add(wanderOffset);
        direction.normalize();
        
        // Set target velocity
        this.targetVelocity.set(
            direction.x * this.maxSpeed,
            0,
            direction.z * this.maxSpeed
        );
    }

    calculateWanderOffset() {
        // Update wander angle with some randomness
        this.wanderAngle += (Math.random() * 2 - 1) * this.wanderJitter;
        
        // Calculate offset based on wander angle
        const offset = new THREE.Vector3(
            Math.cos(this.wanderAngle) * this.wanderRadius,
            0,
            Math.sin(this.wanderAngle) * this.wanderRadius
        );
        
        return offset.multiplyScalar(0.1); // Scale down the effect
    }

    think() {
        const player = game.player1;
        const distanceToPlayer = this.mesh.position.distanceTo(player.mesh.position);

        // State machine for CPU behavior
        switch(this.state) {
            case 'chase':
                if (distanceToPlayer <= this.attackRanges.medium) {
                    this.state = 'attack';
                    this.targetVelocity.multiplyScalar(0.5); // Slow down when entering attack range
                } else {
                    this.moveTowardsPlayer(player);
                }
                break;

            case 'attack':
                if (distanceToPlayer > this.attackRanges.far * 1.5) {
                    this.state = 'chase';
                } else if (distanceToPlayer < this.attackRanges.close * 0.5) {
                    this.state = 'retreat';
                } else {
                    // Slight movement during attack for more dynamic combat
                    this.targetVelocity.multiplyScalar(0.3);
                    this.attackPlayer(player, distanceToPlayer);
                }
                break;

            case 'retreat':
                if (distanceToPlayer > this.attackRanges.medium) {
                    this.state = 'chase';
                } else {
                    this.moveAwayFromPlayer(player);
                }
                break;
        }

        // Random jumps with smoother probability
        if (Math.random() < 0.01 && !this.isJumping) {
            this.jump();
        }

        // Occasionally block attacks
        if (Math.random() < 0.1 && distanceToPlayer < this.attackRanges.medium) {
            this.isBlocking = true;
            setTimeout(() => {
                this.isBlocking = false;
            }, 500 + Math.random() * 500); // Random block duration
        }
    }

    attackPlayer(player, distance) {
        const directionToPlayer = new THREE.Vector3()
            .subVectors(player.mesh.position, this.mesh.position)
            .normalize();
        
        // Smooth rotation towards player
        const targetRotation = Math.atan2(directionToPlayer.x, directionToPlayer.z);
        this.mesh.rotation.y += (targetRotation - this.mesh.rotation.y) * 0.1;
        
        // Only attempt attack if not in cooldown
        if (this.attackCooldown > 0) return;

        // Choose attack based on distance and randomness
        const attackChance = Math.random();
        
        if (distance <= this.attackRanges.close) {
            // Close range - prefer punches
            if (attackChance < 0.4) {
                this.performAttack(player, 'leftPunch');
            } else if (attackChance < 0.8) {
                this.performAttack(player, 'rightPunch');
            }
        } else if (distance <= this.attackRanges.medium) {
            // Medium range - prefer kicks
            if (attackChance < 0.4) {
                this.performAttack(player, 'leftLeg');
            } else if (attackChance < 0.8) {
                this.performAttack(player, 'rightLeg');
            }
        } else if (distance <= this.attackRanges.far && attackChance < 0.2) {
            // Far range - occasional ultra hit
            this.performAttack(player, 'ultraHit');
        }
    }
} 