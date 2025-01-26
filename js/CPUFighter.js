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
    }

    think() {
        const player = game.player1;
        const distanceToPlayer = this.mesh.position.distanceTo(player.mesh.position);

        // State machine for CPU behavior
        switch(this.state) {
            case 'chase':
                if (distanceToPlayer <= this.attackRanges.medium) {
                    this.state = 'attack';
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

        // Random jumps
        if (Math.random() < 0.02) {
            this.jump();
        }
    }

    moveTowardsPlayer(player) {
        const direction = new THREE.Vector3()
            .subVectors(player.mesh.position, this.mesh.position)
            .normalize()
            .multiplyScalar(0.1);
        
        this.move({ x: direction.x, z: direction.z });
    }

    moveAwayFromPlayer(player) {
        const direction = new THREE.Vector3()
            .subVectors(this.mesh.position, player.mesh.position)
            .normalize()
            .multiplyScalar(0.1);
        
        this.move({ x: direction.x, z: direction.z });
    }

    attackPlayer(player, distance) {
        const directionToPlayer = new THREE.Vector3()
            .subVectors(player.mesh.position, this.mesh.position)
            .normalize();
        
        // Face the player before attacking
        this.mesh.rotation.y = Math.atan2(directionToPlayer.x, directionToPlayer.z);
        
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