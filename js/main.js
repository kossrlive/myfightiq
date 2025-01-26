class Game {
    constructor() {
        this.minFOV = 15;
        this.maxFOV = 75;
        this.baseFOV = 45;
        this.isGameOver = false;
        
        // Initialize audio settings
        this.audioEnabled = false;
        this.backgroundMusic = document.getElementById('background-music');
        this.battleMusic = document.getElementById('battle-music');
        this.backgroundMusic.volume = 0.3;
        this.battleMusic.volume = 0.3;

        // Multiplayer properties
        this.socket = null;
        this.playerId = null;
        this.roomId = null;
        this.isMultiplayer = false;
        this.players = new Map();
        this.playerName = '';

        // Always show sound popup first
        this.showSoundPopup().then(() => {
            // Initialize audio if enabled
            if (this.audioEnabled) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                this.backgroundMusic.play().catch(e => console.log('Audio play failed:', e));
            }
            this.setupSplashScreen();
        });
    }

    showSoundPopup() {
        return new Promise((resolve) => {
            const popup = document.createElement('div');
            popup.className = 'sound-popup';
            popup.innerHTML = `
                <h2>Enable Sound?</h2>
                <p>Would you like to enable game sound and music?</p>
                <button id="enable-sound">Yes, Enable Sound</button>
                <button id="disable-sound" class="no-sound">No Sound</button>
            `;
            document.body.appendChild(popup);

            // Handle enable sound
            document.getElementById('enable-sound').addEventListener('click', () => {
                this.audioEnabled = true;
                document.body.removeChild(popup);
                resolve();
            });

            // Handle disable sound
            document.getElementById('disable-sound').addEventListener('click', () => {
                this.audioEnabled = false;
                this.backgroundMusic.volume = 0;
                this.battleMusic.volume = 0;
                document.body.removeChild(popup);
                resolve();
            });
        });
    }

    setupPreviewScene() {
        // Create preview scene
        const previewContainer = document.getElementById('preview-container');
        this.previewScene = new THREE.Scene();
        
        // Add fog to the scene
        this.previewScene.fog = new THREE.FogExp2(0x666666, 0.15);
        
        this.previewCamera = new THREE.PerspectiveCamera(45, 300 / 300, 0.1, 1000);
        this.previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.previewRenderer.setSize(300, 300);
        previewContainer.appendChild(this.previewRenderer.domElement);

        // Add preview lighting
        const previewLight = new THREE.DirectionalLight(0xffffff, 1);
        previewLight.position.set(5, 5, 5);
        this.previewScene.add(previewLight);
        this.previewScene.add(new THREE.AmbientLight(0x404040));

        // Create preview fighter
        this.previewFighter = new Fighter(this.previewScene, { x: 0, y: 1, z: 0 }, 0x0000ff);
        
        // Position camera
        this.previewCamera.position.set(3, 2, 3);
        this.previewCamera.lookAt(0, 1, 0);

        // Create fog particles
        const particleCount = 1000;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleSizes = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            particlePositions[i3] = Math.random() * 10 - 5;
            particlePositions[i3 + 1] = Math.random() * 2;
            particlePositions[i3 + 2] = Math.random() * 10 - 5;
            particleSizes[i] = Math.random() * 2;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

        const particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });

        this.fogParticles = new THREE.Points(particleGeometry, particleMaterial);
        this.previewScene.add(this.fogParticles);

        // Animate preview
        const animatePreview = () => {
            if (!this.previewFighter.isDefeated) {
                this.previewFighter.mesh.rotation.y += 0.01;
                
                // Animate fog particles
                const positions = this.fogParticles.geometry.attributes.position.array;
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] += 0.002; // Move particles along X axis
                    if (positions[i] > 5) positions[i] = -5; // Reset position when out of bounds
                }
                this.fogParticles.geometry.attributes.position.needsUpdate = true;
                
                this.previewRenderer.render(this.previewScene, this.previewCamera);
                requestAnimationFrame(animatePreview);
            }
        };
        animatePreview();
    }

    setupSplashScreen() {
        // Setup preview scene first
        this.setupPreviewScene();

        // Start game function
        const startGame = () => {
            console.log('Starting game...');  // Debug log
            
            // Switch from background music to battle music if enabled
            if (this.audioEnabled) {
                this.backgroundMusic.pause();
                this.backgroundMusic.currentTime = 0;
                this.battleMusic.play().catch(e => console.log('Battle music play failed:', e));
            }
            
            // Remove preview fighter
            if (this.previewFighter) {
                this.previewFighter.isDefeated = true;
                this.previewScene.remove(this.previewFighter.mesh);
            }
            
            document.getElementById('splash-screen').style.display = 'none';
            document.getElementById('game-container').style.display = 'block';
            document.getElementById('game-container').classList.remove('hidden');
            
            // Initialize the game
            this.initGame();
        };

        // Add click event listener to start button
        const startButton = document.getElementById('start-button');
        if (startButton) {
            startButton.onclick = startGame;
        }

        // Add multiplayer button listener
        const multiplayerButton = document.getElementById('multiplayer-button');
        if (multiplayerButton) {
            multiplayerButton.onclick = () => this.showMultiplayerScreen();
        }

        // Add Enter key event listener
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !document.getElementById('splash-screen').classList.contains('hidden')) {
                startGame();
            }
        });
    }

    showMultiplayerScreen() {
        // Hide splash screen and show multiplayer screen
        document.getElementById('splash-screen').style.display = 'none';
        document.getElementById('multiplayer-screen').classList.remove('hidden');

        // Connect to WebSocket server
        this.connectToServer();

        // Setup player slots
        this.setupPlayerSlots();

        // Add event listeners for multiplayer controls
        this.setupMultiplayerControls();
    }

    connectToServer() {
        // Initialize Socket.IO connection
        this.socket = io('http://localhost:8080', {
            reconnectionDelayMax: 10000,
            reconnection: true
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('room_created', (data) => {
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            document.getElementById('room-id').textContent = this.roomId;
            document.getElementById('ready-button').disabled = false;
        });

        this.socket.on('room_joined', (data) => {
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            document.getElementById('room-id').textContent = this.roomId;
            document.getElementById('ready-button').disabled = false;
        });

        this.socket.on('room_state', (data) => {
            this.updatePlayerSlots(data.players);
        });

        this.socket.on('game_start', (data) => {
            this.startMultiplayerGame(data.players);
        });

        this.socket.on('game_update', (data) => {
            if (this.isMultiplayer) {
                this.handleGameUpdate(data);
            }
        });

        this.socket.on('game_over', (data) => {
            if (this.isMultiplayer) {
                this.handleMultiplayerGameOver(data);
            }
        });

        this.socket.on('error', (data) => {
            alert(data.message);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            // Handle reconnection or return to main menu
        });
    }

    setupPlayerSlots() {
        const container = document.querySelector('.player-slots');
        container.innerHTML = ''; // Clear existing slots

        // Create 8 player slots
        for (let i = 0; i < 8; i++) {
            const slot = document.createElement('div');
            slot.className = 'player-slot';
            slot.innerHTML = `
                <div class="player-name">Empty Slot</div>
                <input type="text" class="player-name-input" placeholder="Enter your name" style="display: none;">
                <div class="player-status">Waiting...</div>
            `;
            container.appendChild(slot);
        }
    }

    setupMultiplayerControls() {
        // Back to menu button
        document.getElementById('back-to-menu').addEventListener('click', () => {
            this.socket.disconnect();
            document.getElementById('multiplayer-screen').classList.add('hidden');
            document.getElementById('splash-screen').style.display = 'flex';
        });

        // Create room functionality
        const createRoom = () => {
            const playerName = document.getElementById('player-name-input').value.trim();
            this.playerName = playerName || 'Player 1';
            this.socket.emit('create_room', {
                playerName: this.playerName
            });
        };
        createRoom(); // Automatically create room when entering multiplayer screen

        const joinRoomBtn = document.getElementById('join-room');
        const playerNameInput = document.getElementById('player-name-input');
        const roomIdInput = document.getElementById('room-id-input');

        // Function to validate inputs
        const validateInputs = () => {
            const nameValid = playerNameInput.value.trim().length > 0;
            const roomValid = roomIdInput.value.trim().length > 0;
            joinRoomBtn.disabled = !(nameValid && roomValid);
        };

        // Add input listeners
        playerNameInput.addEventListener('input', validateInputs);
        roomIdInput.addEventListener('input', validateInputs);

        // Initial validation
        validateInputs();

        // Join/Leave room functionality
        joinRoomBtn.addEventListener('click', () => {
            if (this.playerId) {
                // Leave room
                this.socket.emit('leave_room');
                this.playerId = null;
                this.roomId = null;
                joinRoomBtn.textContent = 'Join Room';
                document.getElementById('ready-button').disabled = true;
                roomIdInput.disabled = false;
                playerNameInput.disabled = false;
            } else {
                // Join room
                const roomId = roomIdInput.value.toUpperCase();
                const playerName = playerNameInput.value.trim();
                if (roomId && playerName) {
                    this.playerName = playerName;
                    this.socket.emit('join_room', {
                        roomId,
                        playerName: this.playerName
                    });
                    joinRoomBtn.textContent = 'Leave Room';
                    roomIdInput.disabled = true;
                    playerNameInput.disabled = true;
                }
            }
        });

        // Handle name input changes
        playerNameInput.addEventListener('change', (e) => {
            const newName = e.target.value.trim();
            if (newName && this.playerId) {
                this.playerName = newName;
                this.socket.emit('update_name', {
                    name: newName
                });
            }
        });

        // Copy room ID functionality
        document.getElementById('copy-room-id').addEventListener('click', () => {
            const roomId = document.getElementById('room-id').textContent;
            navigator.clipboard.writeText(roomId);
        });

        // Ready button
        document.getElementById('ready-button').addEventListener('click', () => {
            const button = document.getElementById('ready-button');
            const isReady = button.classList.toggle('ready');
            button.textContent = isReady ? 'UNREADY' : 'READY';
            
            this.socket.emit('player_ready', {
                ready: isReady
            });
        });
    }

    updatePlayerSlots(players) {
        const slots = document.querySelectorAll('.player-slot');
        
        // Reset all slots
        slots.forEach((slot, index) => {
            slot.className = 'player-slot';
            slot.querySelector('.player-name').textContent = 'Empty Slot';
            slot.querySelector('.player-status').textContent = 'Waiting...';
            slot.querySelector('.player-status').className = 'player-status';
        });

        // Update slots with player information
        players.forEach((player, index) => {
            if (index < slots.length) {
                const slot = slots[index];
                slot.className = 'player-slot occupied';
                slot.querySelector('.player-name').textContent = player.name;
                slot.querySelector('.player-status').textContent = player.ready ? 'Ready' : 'Not Ready';
                if (player.ready) {
                    slot.querySelector('.player-status').classList.add('ready');
                }
                if (player.id === this.playerId) {
                    slot.classList.add('current-player');
                }
            }
        });
    }

    startMultiplayerGame(players) {
        this.isMultiplayer = true;
        document.getElementById('multiplayer-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');

        // Initialize multiplayer game with all players
        this.initMultiplayerGame(players);
    }

    initMultiplayerGame(players) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Enhanced lighting
        this.setupLighting();
        
        // Create enhanced environment
        this.createEnvironment();

        // Create fighters for all players
        const positions = this.calculatePlayerPositions(players.length);
        players.forEach((player, index) => {
            const color = player.id === this.playerId ? 0x0000ff : 0xff0000;
            const fighter = new Fighter(this.scene, positions[index], color);
            fighter.name = player.name;
            this.players.set(player.id, fighter);
        });

        // Set up camera
        this.camera.position.set(0, 12, 20);
        this.camera.lookAt(0, 0, 0);

        // Set up controls
        this.controls = new Controls();

        // Create player labels
        this.createPlayerLabels();

        // Initialize player labels Map if not already done
        if (!this.playerLabels) {
            this.playerLabels = new Map();
        }

        // Start game loop
        this.animate();
    }

    calculatePlayerPositions(playerCount) {
        const positions = [];
        const radius = 5;
        const angleStep = (2 * Math.PI) / playerCount;

        for (let i = 0; i < playerCount; i++) {
            const angle = i * angleStep;
            positions.push({
                x: radius * Math.cos(angle),
                y: 1,
                z: radius * Math.sin(angle)
            });
        }

        return positions;
    }

    handleGameUpdate(data) {
        const player = this.players.get(data.playerId);
        if (player) {
            // Update player position and state
            player.mesh.position.copy(data.position);
            player.mesh.rotation.copy(data.rotation);
            player.health = data.health;
            // Update other relevant properties
        }
    }

    handleMultiplayerGameOver(data) {
        const winner = this.players.get(data.winnerId);
        if (winner) {
            this.handleGameOver(winner);
        }
    }

    initGame() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Enhanced lighting
        this.setupLighting();
        
        // Create enhanced environment
        this.createEnvironment();

        // Create fighters with names
        window.game = this;
        this.player1 = new Fighter(this.scene, { x: -3, y: 1, z: 0 }, 0x0000ff);
        this.player1.name = 'Home Shopper';
        
        this.player2 = new CPUFighter(this.scene, { x: 3, y: 1, z: 0 }, 0xff0000);
        this.player2.name = 'Lost Refi';

        // Add name labels under fighters
        this.createPlayerLabels();

        // Set up camera
        this.camera.position.set(0, 12, 20);
        this.camera.lookAt(0, 0, 0);

        // Set up controls
        this.controls = new Controls();

        // Start game loop
        this.animate();
    }

    setupLighting() {
        // Main directional light (sun-like)
        const mainLight = new THREE.DirectionalLight(0xffffff, 1);
        mainLight.position.set(10, 10, 10);
        mainLight.castShadow = true;
        mainLight.shadow.camera.near = 0.1;
        mainLight.shadow.camera.far = 30;
        mainLight.shadow.camera.left = -15;
        mainLight.shadow.camera.right = 15;
        mainLight.shadow.camera.top = 15;
        mainLight.shadow.camera.bottom = -15;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        // Ambient light for overall scene brightness
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
    }

    createEnvironment() {
        // Create textured floor
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x666666,
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Add background walls
        const wallGeometry = new THREE.PlaneGeometry(20, 10);
        const wallMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x444444,
            side: THREE.DoubleSide
        });

        // Back wall
        const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
        backWall.position.z = -10;
        backWall.position.y = 5;
        backWall.receiveShadow = true;
        this.scene.add(backWall);

        // Side walls
        const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
        leftWall.position.x = -10;
        leftWall.position.y = 5;
        leftWall.rotation.y = Math.PI / 2;
        leftWall.receiveShadow = true;
        this.scene.add(leftWall);

        const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
        rightWall.position.x = 10;
        rightWall.position.y = 5;
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.receiveShadow = true;
        this.scene.add(rightWall);

        // Add boundary markers on the floor
        const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const boundaryGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-9, 0.01, -9),
            new THREE.Vector3(-9, 0.01, 9),
            new THREE.Vector3(9, 0.01, 9),
            new THREE.Vector3(9, 0.01, -9),
            new THREE.Vector3(-9, 0.01, -9)
        ]);
        const boundaryLine = new THREE.Line(boundaryGeometry, boundaryMaterial);
        this.scene.add(boundaryLine);

        // Add decorative elements
        this.addDecorations();
    }

    addDecorations() {
        // Add some pillars in the corners
        const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.5, 8, 8);
        const pillarMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
        
        const pillarPositions = [
            { x: -8, z: -8 },
            { x: 8, z: -8 },
            { x: -8, z: 8 },
            { x: 8, z: 8 }
        ];

        pillarPositions.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(pos.x, 4, pos.z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            this.scene.add(pillar);
        });
    }

    handleInput() {
        // Don't handle any input if game is over
        if (this.isGameOver) return;

        const moveSpeed = 0.2;

        // Get the current player's fighter
        let currentPlayer;
        if (this.isMultiplayer) {
            currentPlayer = this.players.get(this.playerId);
        } else {
            currentPlayer = this.player1;
        }

        if (!currentPlayer) return;

        // Movement
        if (this.controls.isPressed('w')) currentPlayer.move({ x: 0, z: -moveSpeed });
        if (this.controls.isPressed('s')) currentPlayer.move({ x: 0, z: moveSpeed });
        if (this.controls.isPressed('a')) currentPlayer.move({ x: -moveSpeed, z: 0 });
        if (this.controls.isPressed('d')) currentPlayer.move({ x: moveSpeed, z: 0 });
        if (this.controls.isPressed(' ')) currentPlayer.jump();

        // Block
        currentPlayer.isBlocking = this.controls.isPressed('c');

        // Get target for attacks
        let target;
        if (this.isMultiplayer) {
            // Find the closest opponent
            let closestDistance = Infinity;
            for (const [id, fighter] of this.players) {
                if (id !== this.playerId) {
                    const distance = currentPlayer.mesh.position.distanceTo(fighter.mesh.position);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        target = fighter;
                    }
                }
            }
        } else {
            target = this.player2;
        }

        if (!target) return;

        // Attacks
        if (this.controls.isPressed('ArrowUp')) {
            currentPlayer.performAttack(target, 'leftPunch');
        }
        if (this.controls.isPressed('ArrowRight')) {
            currentPlayer.performAttack(target, 'rightPunch');
        }
        if (this.controls.isPressed('ArrowLeft')) {
            currentPlayer.performAttack(target, 'leftLeg');
        }
        if (this.controls.isPressed('ArrowDown')) {
            currentPlayer.performAttack(target, 'rightLeg');
        }

        // Ultra Hit
        if (this.controls.isPressed('f') || this.controls.isPressed('F')) {
            currentPlayer.performAttack(target, 'ultraHit');
        }
    }

    updateCamera() {
        if (this.isMultiplayer) {
            // Calculate center point and max distance between all players
            let centerPoint = new THREE.Vector3();
            let maxDistance = 0;
            let playerCount = 0;
            
            this.players.forEach((fighter) => {
                centerPoint.add(fighter.mesh.position);
                playerCount++;
                
                // Calculate max distance between any two players
                this.players.forEach((otherFighter) => {
                    if (fighter !== otherFighter) {
                        const distance = fighter.mesh.position.distanceTo(otherFighter.mesh.position);
                        maxDistance = Math.max(maxDistance, distance);
                    }
                });
            });
            
            // Get average position
            centerPoint.divideScalar(playerCount);
            
            // Adjust FOV based on max distance
            const maxAllowedDistance = 18;
            const minAllowedDistance = 2;
            
            const newFOV = THREE.MathUtils.lerp(
                this.minFOV,
                this.maxFOV,
                Math.min(Math.max((maxDistance - minAllowedDistance) / (maxAllowedDistance - minAllowedDistance), 0), 1)
            );
            
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, newFOV, 0.1);
            
            const cameraHeight = 12;
            const cameraDistance = 20;
            this.camera.position.set(
                centerPoint.x,
                cameraHeight,
                centerPoint.z + cameraDistance
            );
            
            this.camera.lookAt(centerPoint.x, 0, centerPoint.z);
            
        } else {
            // Original single-player camera logic
            const distance = this.player1.mesh.position.distanceTo(this.player2.mesh.position);
            const centerPoint = new THREE.Vector3()
                .addVectors(this.player1.mesh.position, this.player2.mesh.position)
                .multiplyScalar(0.5);
            
            const maxDistance = 18;
            const minDistance = 2;
            
            const newFOV = THREE.MathUtils.lerp(
                this.minFOV,
                this.maxFOV,
                Math.min(Math.max((distance - minDistance) / (maxDistance - minDistance), 0), 1)
            );
            
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, newFOV, 0.1);
            
            const cameraHeight = 12;
            const cameraDistance = 20;
            this.camera.position.set(
                centerPoint.x,
                cameraHeight,
                centerPoint.z + cameraDistance
            );
            
            this.camera.lookAt(centerPoint.x, 0, centerPoint.z);
        }
        
        this.camera.updateProjectionMatrix();
    }

    createPlayerLabels() {
        if (this.isMultiplayer) {
            this.playerLabels = new Map();
            this.players.forEach((fighter, id) => {
                const label = document.createElement('div');
                label.className = 'player-label';
                label.textContent = fighter.name;
                document.getElementById('game-container').appendChild(label);
                this.playerLabels.set(id, label);
            });
        } else {
            const createLabel = (name) => {
                const div = document.createElement('div');
                div.className = 'player-label';
                div.textContent = name;
                return div;
            };

            this.player1Label = createLabel(this.player1.name);
            this.player2Label = createLabel(this.player2.name);
            document.getElementById('game-container').appendChild(this.player1Label);
            document.getElementById('game-container').appendChild(this.player2Label);
        }
    }

    updatePlayerLabels() {
        // Skip if labels aren't initialized yet
        if (!this.playerLabels) return;

        const updateLabel = (label, fighter) => {
            const vector = new THREE.Vector3();
            vector.setFromMatrixPosition(fighter.mesh.matrixWorld);
            vector.project(this.camera);

            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-vector.y * 0.5 + 0.5) * window.innerHeight + 50;

            label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        };

        if (this.isMultiplayer) {
            this.players.forEach((fighter, id) => {
                const label = this.playerLabels.get(id);
                if (label) {
                    updateLabel(label, fighter);
                }
            });
        } else {
            if (this.player1Label && this.player1) {
                updateLabel(this.player1Label, this.player1);
            }
            if (this.player2Label && this.player2) {
                updateLabel(this.player2Label, this.player2);
            }
        }
    }

    handleGameOver(defeatedFighter) {
        if (this.isGameOver) return;
        this.isGameOver = true;

        // Stop battle music if enabled
        if (this.audioEnabled) {
            this.battleMusic.pause();
            this.battleMusic.currentTime = 0;
        }

        // Create winner announcement
        let winnerName;
        if (this.isMultiplayer) {
            // In multiplayer, we get the winner directly from the remaining player
            for (const [id, fighter] of this.players) {
                if (!fighter.isDefeated) {
                    winnerName = fighter.name;
                    break;
                }
            }
        } else {
            // In single player, we compare with player1
            winnerName = (defeatedFighter === this.player1) ? this.player2.name : this.player1.name;
        }

        const announcement = document.createElement('div');
        announcement.className = 'winner-announcement';
        announcement.innerHTML = `
            <h1>${winnerName || 'Unknown Player'} WINS!</h1>
            <button id="restart-button">PLAY AGAIN</button>
        `;
        document.getElementById('game-container').appendChild(announcement);

        // Add restart functionality
        document.getElementById('restart-button').addEventListener('click', () => {
            location.reload();
        });
    }

    animate() {
        if (!this.isGameOver) {
            this.handleInput();
        }
        
        // Update physics
        if (this.isMultiplayer) {
            // Update all players in multiplayer mode
            this.players.forEach(fighter => {
                fighter.update();
            });
        } else {
            // Update player1 and player2 in single player mode
            this.player1.update();
            this.player2.update();
        }
        
        // Update camera
        this.updateCamera();
        
        // Update player labels
        this.updatePlayerLabels();
        
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize only the splash screen
const game = new Game();

// Handle window resize
window.addEventListener('resize', () => {
    if (game.camera) {
        game.camera.aspect = window.innerWidth / window.innerHeight;
        game.camera.updateProjectionMatrix();
        game.renderer.setSize(window.innerWidth, window.innerHeight);
    }
});