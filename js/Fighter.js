class Fighter {
    constructor(scene, position, color) {
        this.health = 100;
        this.position = position;
        this.velocity = { x: 0, y: 0, z: 0 };
        this.isJumping = false;
        
        // Create fighter group to hold all body parts
        this.mesh = new THREE.Group();
        
        // Create body parts with consistent proportions
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color,
            shininess: 30,
            specular: 0x666666
        });
        
        // Torso (more detailed with chest and abdomen)
        const torsoUpper = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.4, 0.3),
            bodyMaterial
        );
        torsoUpper.position.y = 0.8;
        
        const torsoLower = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.3, 0.25),
            bodyMaterial
        );
        torsoLower.position.y = 0.5;
        
        // Head with neck
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.12, 0.1),
            bodyMaterial
        );
        neck.position.y = 1.0;
        
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 12, 12),
            bodyMaterial
        );
        head.position.y = 1.25;
        
        // Arms with consistent proportions
        const createArm = (isLeft) => {
            const arm = new THREE.Group();
            
            // Shoulder
            const shoulder = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 8, 8),
                bodyMaterial
            );
            
            // Upper arm
            const upperArm = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.06, 0.3),
                bodyMaterial
            );
            upperArm.position.y = -0.15;
            
            // Elbow
            const elbow = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 8, 8),
                bodyMaterial
            );
            elbow.position.y = -0.3;
            
            // Lower arm
            const lowerArm = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.04, 0.3),
                bodyMaterial
            );
            lowerArm.position.y = -0.45;
            
            // Hand
            const hand = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.12, 0.08),
                bodyMaterial
            );
            hand.position.y = -0.6;
            
            arm.add(shoulder, upperArm, elbow, lowerArm, hand);
            arm.position.set(isLeft ? -0.35 : 0.35, 0.9, 0);
            return arm;
        };
        
        const leftArm = createArm(true);
        const rightArm = createArm(false);
        
        // Legs with consistent proportions
        const createLeg = (isLeft) => {
            const leg = new THREE.Group();
            
            // Hip
            const hip = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 8, 8),
                bodyMaterial
            );
            
            // Upper leg
            const upperLeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.06, 0.3),
                bodyMaterial
            );
            upperLeg.position.y = -0.15;
            
            // Knee
            const knee = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 8, 8),
                bodyMaterial
            );
            knee.position.y = -0.3;
            
            // Lower leg
            const lowerLeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.04, 0.3),
                bodyMaterial
            );
            lowerLeg.position.y = -0.45;
            
            // Foot
            const foot = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.05, 0.15),
                bodyMaterial
            );
            foot.position.set(0, -0.6, 0.05);
            
            leg.add(hip, upperLeg, knee, lowerLeg, foot);
            leg.position.set(isLeft ? -0.2 : 0.2, 0.3, 0);
            return leg;
        };
        
        const leftLeg = createLeg(true);
        const rightLeg = createLeg(false);
        
        // Add all parts to the group
        this.mesh.add(torsoUpper, torsoLower, neck, head, leftArm, rightArm, leftLeg, rightLeg);
        
        // Position the entire fighter
        this.mesh.position.set(position.x, position.y, position.z);
        
        // Add shadow
        this.mesh.traverse((object) => {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });
        
        scene.add(this.mesh);
        
        // Add arena boundaries
        this.arenaBounds = {
            minX: -9,
            maxX: 9,
            minZ: -9,
            maxZ: 9
        };

        // Store body parts for animations
        this.bodyParts = {
            leftArm,
            rightArm,
            leftLeg,
            rightLeg
        };

        // Animation properties
        this.animationState = {
            walkCycle: 0,
            isMoving: false
        };

        // Store original arm dimensions for punch animation
        this.originalArmScale = {
            y: 0.6,  // Original arm length
            position: rightArm.position.clone()
        };

        // Add attack state
        this.isAttacking = false;
        this.attackCooldown = 0;

        // Add collision radius
        this.collisionRadius = 0.8;  // Increased to prevent sticking
        this.pushForce = 0.2;       // Force to push fighters apart when colliding

        // Add new combat states
        this.isBlocking = false;
        this.blockingDamageReduction = 0.5; // 50% damage reduction when blocking

        // Different attack types with adjusted ranges
        this.attacks = {
            leftPunch: { damage: 5, cooldown: 10, range: 1.2, animation: 'leftPunch' },
            rightPunch: { damage: 15, cooldown: 30, range: 1.4, animation: 'rightPunch' },
            leftLeg: { damage: 7, cooldown: 15, range: 1.6, animation: 'leftLeg' },
            rightLeg: { damage: 20, cooldown: 40, range: 1.8, animation: 'rightLeg' },
            ultraHit: { damage: 40, cooldown: 100, range: 2.0, animation: 'ultraHit' }
        };

        // Add sound effects with adjusted volumes
        this.sounds = {
            punch: new Audio('sounds/punch.mp3'),  // Wind-up sound
            swing: new Audio('sounds/swing.mp3'),  // Whoosh sound
            hit: new Audio('sounds/hit.mp3')       // Impact sound
        };

        // Preload sounds with different volumes for each type
        Object.entries(this.sounds).forEach(([type, sound]) => {
            sound.load();
            // Different volumes for different sound types
            sound.volume = type === 'hit' ? 0.4 : 
                         type === 'punch' ? 0.2 : 
                         0.25; // swing volume
        });

        this.name = ''; // Will be set in Game class
        this.isDefeated = false;

        // Store all body parts in an array for disassembly
        this.allBodyParts = [
            { mesh: torsoUpper, velocity: new THREE.Vector3() },
            { mesh: torsoLower, velocity: new THREE.Vector3() },
            { mesh: neck, velocity: new THREE.Vector3() },
            { mesh: head, velocity: new THREE.Vector3() },
            { mesh: leftArm, velocity: new THREE.Vector3() },
            { mesh: rightArm, velocity: new THREE.Vector3() },
            { mesh: leftLeg, velocity: new THREE.Vector3() },
            { mesh: rightLeg, velocity: new THREE.Vector3() }
        ];

        this.isDisassembled = false;
        this.gravity = -0.01;
        this.bounceFactor = 0.5;

        // Add block animation state
        this.blockState = {
            isAnimating: false,
            targetRotation: {
                leftArm: new THREE.Vector3(-Math.PI/2, 0, -Math.PI/4),
                rightArm: new THREE.Vector3(-Math.PI/2, 0, Math.PI/4)
            },
            originalRotation: {
                leftArm: new THREE.Vector3(),
                rightArm: new THREE.Vector3()
            }
        };

        // Store original rotations
        this.blockState.originalRotation.leftArm.copy(this.bodyParts.leftArm.rotation);
        this.blockState.originalRotation.rightArm.copy(this.bodyParts.rightArm.rotation);
    }

    move(direction) {
        // Calculate new position
        const newX = this.mesh.position.x + direction.x;
        const newZ = this.mesh.position.z + direction.z;

        // Store current position in case we need to revert
        const oldPosition = this.mesh.position.clone();

        // Check boundaries before moving
        if (newX >= this.arenaBounds.minX && newX <= this.arenaBounds.maxX) {
            this.mesh.position.x = newX;
        }
        if (newZ >= this.arenaBounds.minZ && newZ <= this.arenaBounds.maxZ) {
            this.mesh.position.z = newZ;
        }

        // Check collision with other fighters
        if (game.isMultiplayer) {
            for (const [id, otherFighter] of game.players) {
                if (id !== game.playerId && this.checkCollision(otherFighter)) {
                    // Calculate push direction
                    const pushDirection = new THREE.Vector3()
                        .subVectors(this.mesh.position, otherFighter.mesh.position)
                        .normalize()
                        .multiplyScalar(this.pushForce);
                    
                    // Check if push would send either fighter outside bounds
                    const myNewPos = this.mesh.position.clone().add(pushDirection);
                    const otherNewPos = otherFighter.mesh.position.clone().sub(pushDirection);
                    
                    const myInBounds = this.isPositionInBounds(myNewPos);
                    const otherInBounds = this.isPositionInBounds(otherNewPos);
                    
                    // Only apply push if both fighters would stay in bounds
                    if (myInBounds && otherInBounds) {
                        this.mesh.position.add(pushDirection);
                        // In multiplayer, we don't directly move other players
                        // Instead, send position update to server
                        game.socket.emit('game_update', {
                            gameData: {
                                position: otherFighter.mesh.position.clone().sub(pushDirection),
                                rotation: otherFighter.mesh.rotation.clone(),
                                health: otherFighter.health
                            }
                        });
                    } else {
                        // If push would send someone out of bounds, just revert position
                        this.mesh.position.copy(oldPosition);
                    }
                }
            }
        } else {
            // Original single-player collision check
            const otherFighter = this === game.player1 ? game.player2 : game.player1;
            if (this.checkCollision(otherFighter)) {
                // Calculate push direction
                const pushDirection = new THREE.Vector3()
                    .subVectors(this.mesh.position, otherFighter.mesh.position)
                    .normalize()
                    .multiplyScalar(this.pushForce);
                
                // Check if push would send either fighter outside bounds
                const myNewPos = this.mesh.position.clone().add(pushDirection);
                const otherNewPos = otherFighter.mesh.position.clone().sub(pushDirection);
                
                const myInBounds = this.isPositionInBounds(myNewPos);
                const otherInBounds = this.isPositionInBounds(otherNewPos);
                
                // Only apply push if both fighters would stay in bounds
                if (myInBounds && otherInBounds) {
                    this.mesh.position.add(pushDirection);
                    otherFighter.mesh.position.sub(pushDirection);
                } else {
                    // If push would send someone out of bounds, just revert position
                    this.mesh.position.copy(oldPosition);
                }
            }
        }

        // Update walking animation
        if (direction.x !== 0 || direction.z !== 0) {
            this.animationState.isMoving = true;
            this.updateWalkAnimation();
        } else {
            this.animationState.isMoving = false;
            this.resetPoseAnimation();
        }

        // Rotate fighter in movement direction
        if (direction.x !== 0 || direction.z !== 0) {
            this.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        }

        // Send position update in multiplayer mode
        if (game.isMultiplayer && game.socket) {
            game.socket.emit('game_update', {
                gameData: {
                    position: this.mesh.position.clone(),
                    rotation: this.mesh.rotation.clone(),
                    health: this.health
                }
            });
        }
    }

    updateWalkAnimation() {
        const speed = 0.15;
        this.animationState.walkCycle += speed;
        
        // Only animate parts that aren't attacking or blocking
        const legSwing = Math.sin(this.animationState.walkCycle) * 0.3;
        
        // Animate legs
        this.bodyParts.leftLeg.rotation.x = legSwing;
        this.bodyParts.rightLeg.rotation.x = -legSwing;
        
        // Only animate arms if they're not being used for attacks or blocking
        if (!this.isAttacking && !this.isBlocking) {
            this.bodyParts.leftArm.rotation.x = -legSwing;
            this.bodyParts.rightArm.rotation.x = legSwing;
        }
    }

    resetPoseAnimation() {
        // Only reset parts that aren't attacking or blocking
        if (!this.isBlocking && !this.isAttacking) {
            Object.values(this.bodyParts).forEach(part => {
                part.rotation.x = 0;
                part.rotation.z = 0;
            });
        } else if (!this.isAttacking) {
            // Reset only legs if we're blocking
            this.bodyParts.leftLeg.rotation.x = 0;
            this.bodyParts.rightLeg.rotation.x = 0;
        }
    }

    jump() {
        if (!this.isJumping) {
            this.velocity.y = 0.3;
            this.isJumping = true;
        }
    }

    update() {
        if (this.isDefeated) {
            this.defeat();
        }
        if (this.isDisassembled) {
            this.updateDisassembly();
        }

        // Update block animation
        this.updateBlockAnimation();

        // Apply gravity
        this.velocity.y -= 0.015;
        this.mesh.position.y += this.velocity.y;

        // Ground collision
        if (this.mesh.position.y <= 1) {
            this.mesh.position.y = 1;
            this.velocity.y = 0;
            this.isJumping = false;
        }

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }
    }

    updateBlockAnimation() {
        const ANIMATION_SPEED = 0.2;
        
        if (this.isBlocking && !this.blockState.isAnimating) {
            // Start block animation
            this.blockState.isAnimating = true;
            
            // Smoothly move arms to blocking position
            const leftArm = this.bodyParts.leftArm;
            const rightArm = this.bodyParts.rightArm;
            
            leftArm.rotation.x = THREE.MathUtils.lerp(
                leftArm.rotation.x,
                this.blockState.targetRotation.leftArm.x,
                ANIMATION_SPEED
            );
            leftArm.rotation.z = THREE.MathUtils.lerp(
                leftArm.rotation.z,
                this.blockState.targetRotation.leftArm.z,
                ANIMATION_SPEED
            );
            
            rightArm.rotation.x = THREE.MathUtils.lerp(
                rightArm.rotation.x,
                this.blockState.targetRotation.rightArm.x,
                ANIMATION_SPEED
            );
            rightArm.rotation.z = THREE.MathUtils.lerp(
                rightArm.rotation.z,
                this.blockState.targetRotation.rightArm.z,
                ANIMATION_SPEED
            );
            
        } else if (!this.isBlocking && this.blockState.isAnimating) {
            // Return to normal position
            this.blockState.isAnimating = false;
            
            const leftArm = this.bodyParts.leftArm;
            const rightArm = this.bodyParts.rightArm;
            
            leftArm.rotation.x = THREE.MathUtils.lerp(
                leftArm.rotation.x,
                this.blockState.originalRotation.leftArm.x,
                ANIMATION_SPEED
            );
            leftArm.rotation.z = THREE.MathUtils.lerp(
                leftArm.rotation.z,
                this.blockState.originalRotation.leftArm.z,
                ANIMATION_SPEED
            );
            
            rightArm.rotation.x = THREE.MathUtils.lerp(
                rightArm.rotation.x,
                this.blockState.originalRotation.rightArm.x,
                ANIMATION_SPEED
            );
            rightArm.rotation.z = THREE.MathUtils.lerp(
                rightArm.rotation.z,
                this.blockState.originalRotation.rightArm.z,
                ANIMATION_SPEED
            );
        }
    }

    isInRange(target) {
        const distance = this.mesh.position.distanceTo(target.mesh.position);
        return distance <= 3; // Increased from default to make it easier to hit
    }

    performAttack(target, type) {
        if (!this.isInRange(target) || this.isAttacking || target.isDefeated) return;
        
        // Play swing sound
        const swingSound = document.getElementById('swing-sound');
        if (swingSound) swingSound.play();

        this.isAttacking = true;
        const attackDuration = 500; // milliseconds

        // Different attacks
        switch(type) {
            case 'leftPunch':
                this.animateLeftPunch();
                setTimeout(() => {
                    if (this.checkHit(target) && !target.isBlocking) {
                        target.takeDamage(10);
                        // Play hit sound
                        const hitSound = document.getElementById('hit-sound');
                        if (hitSound) hitSound.play();
                        if (game.isMultiplayer) {
                            game.socket.emit('game_update', {
                                gameData: {
                                    targetId: Array.from(game.players.entries())
                                        .find(([_, f]) => f === target)?.[0],
                                    damage: 10,
                                    health: target.health
                                }
                            });
                        }
                    }
                }, attackDuration / 2);
                break;
            case 'rightPunch':
                this.animateRightPunch();
                setTimeout(() => {
                    if (this.checkHit(target) && !target.isBlocking) {
                        target.takeDamage(12);
                        // Play hit sound
                        const hitSound = document.getElementById('hit-sound');
                        if (hitSound) hitSound.play();
                        if (game.isMultiplayer) {
                            game.socket.emit('game_update', {
                                gameData: {
                                    targetId: Array.from(game.players.entries())
                                        .find(([_, f]) => f === target)?.[0],
                                    damage: 12,
                                    health: target.health
                                }
                            });
                        }
                    }
                }, attackDuration / 2);
                break;
            case 'leftLeg':
                this.animateLeftLeg();
                setTimeout(() => {
                    if (this.checkHit(target) && !target.isBlocking) {
                        target.takeDamage(15);
                        // Play hit sound
                        const hitSound = document.getElementById('hit-sound');
                        if (hitSound) hitSound.play();
                        if (game.isMultiplayer) {
                            game.socket.emit('game_update', {
                                gameData: {
                                    targetId: Array.from(game.players.entries())
                                        .find(([_, f]) => f === target)?.[0],
                                    damage: 15,
                                    health: target.health
                                }
                            });
                        }
                    }
                }, attackDuration / 2);
                break;
            case 'rightLeg':
                this.animateRightLeg();
                setTimeout(() => {
                    if (this.checkHit(target) && !target.isBlocking) {
                        target.takeDamage(20);
                        // Play hit sound
                        const hitSound = document.getElementById('hit-sound');
                        if (hitSound) hitSound.play();
                        if (game.isMultiplayer) {
                            game.socket.emit('game_update', {
                                gameData: {
                                    targetId: Array.from(game.players.entries())
                                        .find(([_, f]) => f === target)?.[0],
                                    damage: 20,
                                    health: target.health
                                }
                            });
                        }
                    }
                }, attackDuration / 2);
                break;
            case 'ultraHit':
                if (this.ultraHitCooldown) return;
                this.animateUltraHit();
                setTimeout(() => {
                    if (this.checkHit(target)) {
                        target.takeDamage(40);
                        // Play hit sound
                        const hitSound = document.getElementById('hit-sound');
                        if (hitSound) hitSound.play();
                        if (game.isMultiplayer) {
                            game.socket.emit('game_update', {
                                gameData: {
                                    targetId: Array.from(game.players.entries())
                                        .find(([_, f]) => f === target)?.[0],
                                    damage: 40,
                                    health: target.health
                                }
                            });
                        }
                    }
                    // Reset attack state after ultra hit completes
                    this.isAttacking = false;
                    this.resetPoseAnimation();
                }, attackDuration / 2);
                this.ultraHitCooldown = true;
                setTimeout(() => {
                    this.ultraHitCooldown = false;
                }, 5000); // 5 second cooldown
                return; // Return early for ultra hit since we handle the reset separately
        }

        setTimeout(() => {
            this.isAttacking = false;
            this.resetPoseAnimation();
        }, attackDuration);
    }

    checkHit(target) {
        const distance = this.mesh.position.distanceTo(target.mesh.position);
        return distance <= 4; // Increased hit check distance
    }

    animateLeftPunch() {
        const leftArm = this.bodyParts.leftArm;
        this.animatePunch(leftArm, 1.5, 80, () => {
            // Play hit sound on successful hit
            this.sounds.hit.currentTime = 0;
            this.sounds.hit.volume = 0.4;
            this.sounds.hit.play();
        });
    }

    animateRightPunch() {
        const rightArm = this.bodyParts.rightArm;
        this.animatePunch(rightArm, 2, 120, () => {
            // Play hit sound on successful hit
            this.sounds.hit.currentTime = 0;
            this.sounds.hit.volume = 0.4;
            this.sounds.hit.play();
        });
    }

    animateLeftLeg() {
        const leftLeg = this.bodyParts.leftLeg;
        this.animateLegKick(leftLeg, 1.5, 80, () => {
            // Play hit sound on successful hit
            this.sounds.hit.currentTime = 0;
            this.sounds.hit.volume = 0.4;
            this.sounds.hit.play();
        });
    }

    animateRightLeg() {
        const rightLeg = this.bodyParts.rightLeg;
        this.animateLegKick(rightLeg, 2, 120, () => {
            // Play hit sound on successful hit
            this.sounds.hit.currentTime = 0;
            this.sounds.hit.volume = 0.4;
            this.sounds.hit.play();
        });
    }

    animateUltraHit() {
        // Flash effect
        this.mesh.traverse((object) => {
            if (object.isMesh) {
                object.material.emissive.setHex(0xff0000);
            }
        });

        // Perform both arm and leg attack
        const rightArm = this.bodyParts.rightArm;
        const rightLeg = this.bodyParts.rightLeg;
        
        this.animatePunch(rightArm, 3, 150, () => {
            this.animateLegKick(rightLeg, 3, 150, () => {
                // Reset flash effect
                setTimeout(() => {
                    this.mesh.traverse((object) => {
                        if (object.isMesh) {
                            object.material.emissive.setHex(0x000000);
                        }
                    });
                }, 300);
            });
        });
    }

    animatePunch(limb, maxStretch, duration, onHit) {
        const originalRotation = limb.rotation.x;
        
        // Animation parameters
        const stretchDuration = duration;
        const retractDuration = duration;
        
        // Stretch out animation
        const stretchOut = () => {
            const startTime = Date.now();
            const animate = () => {
                const progress = (Date.now() - startTime) / stretchDuration;
                
                if (progress < 1) {
                    // Only rotate the arm forward, keep shoulder fixed
                    limb.rotation.x = originalRotation - (Math.PI / 2) * progress;
                    
                    requestAnimationFrame(animate);
                } else {
                    // Play swing sound at full extension
                    this.sounds.swing.currentTime = 0;
                    this.sounds.swing.play();
                    
                    onHit();
                    retract();
                }
            };
            animate();
        };

        // Retract animation
        const retract = () => {
            const startTime = Date.now();
            const animate = () => {
                const progress = (Date.now() - startTime) / retractDuration;
                
                if (progress < 1) {
                    // Return to original rotation only
                    limb.rotation.x = originalRotation - Math.PI/2 + (Math.PI/2) * progress;
                    
                    requestAnimationFrame(animate);
                } else {
                    // Reset only rotation
                    limb.rotation.x = originalRotation;
                    this.isAttacking = false;
                    this.attackCooldown = 20;
                }
            };
            animate();
        };

        stretchOut();
    }

    animateLegKick(limb, maxStretch, duration, onHit) {
        const originalRotation = limb.rotation.x;
        const originalPosition = limb.position.clone();
        
        // Animation parameters
        const stretchDuration = duration;
        const retractDuration = duration;
        
        // Kick out animation
        const kickOut = () => {
            const startTime = Date.now();
            const animate = () => {
                const progress = (Date.now() - startTime) / stretchDuration;
                
                if (progress < 1) {
                    // Only rotate the leg, keep the mount point fixed
                    limb.rotation.x = originalRotation - Math.PI * 0.7 * progress;
                    
                    // Don't move the entire leg group, just rotate
                    requestAnimationFrame(animate);
                } else {
                    onHit();
                    retract();
                }
            };
            animate();
        };

        // Retract animation
        const retract = () => {
            const startTime = Date.now();
            const animate = () => {
                const progress = (Date.now() - startTime) / retractDuration;
                
                if (progress < 1) {
                    // Return to original rotation only
                    limb.rotation.x = originalRotation - Math.PI * 0.7 * (1 - progress);
                    
                    requestAnimationFrame(animate);
                } else {
                    // Reset only rotation, position stays fixed
                    limb.rotation.x = originalRotation;
                    this.isAttacking = false;
                    this.attackCooldown = 20;
                }
            };
            animate();
        };

        kickOut();
    }

    playDefeatAnimation() {
        // Rotate the fighter to lie on their back
        const fallAnimation = () => {
            const targetRotation = -Math.PI / 2;
            const duration = 1000; // 1 second
            const startTime = Date.now();
            const startRotation = this.mesh.rotation.x;

            const animate = () => {
                const progress = (Date.now() - startTime) / duration;
                if (progress < 1) {
                    this.mesh.rotation.x = startRotation + (targetRotation * progress);
                    requestAnimationFrame(animate);
                } else {
                    this.mesh.rotation.x = targetRotation;
                }
            };
            animate();
        };

        fallAnimation();
    }

    defeat() {
        if (this.isDefeated && !this.isDisassembled) {
            this.isDisassembled = true;
            
            // Detach all parts from the main group
            this.allBodyParts.forEach(part => {
                // Store the world position and rotation
                const worldPosition = new THREE.Vector3();
                const worldQuaternion = new THREE.Quaternion();
                part.mesh.getWorldPosition(worldPosition);
                part.mesh.getWorldQuaternion(worldQuaternion);
                
                // Remove from group and add directly to scene
                this.mesh.remove(part.mesh);
                this.mesh.parent.add(part.mesh);
                
                // Restore world position and rotation
                part.mesh.position.copy(worldPosition);
                part.mesh.quaternion.copy(worldQuaternion);
                
                // Add random velocity and rotation
                part.velocity.set(
                    (Math.random() - 0.5) * 0.2,
                    Math.random() * 0.2,
                    (Math.random() - 0.5) * 0.2
                );
                part.rotationVelocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1
                );
            });
        }
    }

    updateDisassembly() {
        if (!this.isDisassembled) return;

        this.allBodyParts.forEach(part => {
            // Update position
            part.velocity.y += this.gravity;
            part.mesh.position.add(part.velocity);

            // Update rotation
            part.mesh.rotation.x += part.rotationVelocity.x;
            part.mesh.rotation.y += part.rotationVelocity.y;
            part.mesh.rotation.z += part.rotationVelocity.z;

            // Floor bounce
            if (part.mesh.position.y < 0) {
                part.mesh.position.y = 0;
                part.velocity.y = -part.velocity.y * this.bounceFactor;
                part.velocity.x *= 0.8;
                part.velocity.z *= 0.8;
            }
        });
    }

    checkCollision(otherFighter) {
        const distance = this.mesh.position.distanceTo(otherFighter.mesh.position);
        const minDistance = this.collisionRadius + otherFighter.collisionRadius;
        return distance < minDistance;
    }

    isPositionInBounds(position) {
        return position.x >= this.arenaBounds.minX &&
               position.x <= this.arenaBounds.maxX &&
               position.z >= this.arenaBounds.minZ &&
               position.z <= this.arenaBounds.maxZ;
    }

    takeDamage(amount) {
        // Apply damage reduction if blocking
        const actualDamage = this.isBlocking ? 
            Math.max(0, amount * (1 - this.blockingDamageReduction)) : 
            amount;
        
        // Update health and clamp it between 0 and 100
        this.health = Math.max(0, Math.min(100, this.health - actualDamage));
        
        // Update health bar
        if (game.isMultiplayer) {
            const healthBar = document.querySelector(`[data-player-id="${game.playerId}"] .health-fill`);
            if (healthBar) {
                healthBar.style.width = `${this.health}%`;
            }
        } else {
            const healthBar = document.getElementById(this === game.player1 ? 'player1-health' : 'player2-health');
            if (healthBar) {
                healthBar.style.width = `${this.health}%`;
            }
        }

        // Only apply visual feedback if the fighter is not disassembled
        if (!this.isDisassembled && this.mesh.children.length > 0) {
            // Visual feedback for taking damage or blocking
            const originalColor = this.mesh.children[0].material.color.getHex();
            this.mesh.traverse((object) => {
                if (object.isMesh) {
                    // Flash blue for successful block, white for taking damage
                    object.material.color.setHex(this.isBlocking ? 0x0088ff : 0xffffff);
                }
            });

            // Reset color after flash
            setTimeout(() => {
                if (!this.isDisassembled && this.mesh.children.length > 0) {
                    this.mesh.traverse((object) => {
                        if (object.isMesh) {
                            object.material.color.setHex(originalColor);
                        }
                    });
                }
            }, 100);
        }

        // Check for defeat
        if (this.health <= 0 && !this.isDefeated) {
            this.isDefeated = true;
            this.playDefeatAnimation();
            if (game.isMultiplayer) {
                game.socket.emit('player_defeated', {
                    defeatedId: game.playerId
                });
            } else {
                game.handleGameOver(this);
            }
        }
    }
}