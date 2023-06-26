//initialize variables
let model
let videoWidth, videoHeight
let ctx, canvas
let handPosition = [];
const trainButtons = document.querySelector("#trainButtons")
const resultPrediction = document.querySelector("#result")
const VIDEO_WIDTH = 560
const VIDEO_HEIGHT = 405
let score = 0;


window.addEventListener('beforeunload', saveTraining);

const k = 10

const data = fetch("src/data.json").then(res => res.json());
const knn = new kNear(k, data)
knn.load();


trainButtons.addEventListener('click', trainingHandler)

async function main() {
    model = await handpose.load()
    const video = await setupCamera()
    video.play()
    await startLandmarkDetection(video)
}


async function setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam not available");
    }

    const video = document.getElementById("video");
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: "user",
            width: VIDEO_WIDTH,
            height: VIDEO_HEIGHT,
        },
    });
    video.srcObject = stream;

    return new Promise(resolve => {
        video.onloadedmetadata = () => {
            resolve(video)
        }
    })
}

function saveTraining () {
    knn.save()
    console.log("training saved")
}

async function startLandmarkDetection(video) {

    videoWidth = video.videoWidth
    videoHeight = video.videoHeight

    canvas = document.getElementById("output")

    canvas.width = videoWidth
    canvas.height = videoHeight

    ctx = canvas.getContext("2d")

    video.width = videoWidth
    video.height = videoHeight

    ctx.clearRect(0, 0, videoWidth, videoHeight)
    ctx.strokeStyle = "red"
    ctx.fillStyle = "red"

    //flip the video horizontally
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)

    predictLandmarks()
}

//
// predict de locatie van de vingers met het model
//
async function predictLandmarks() {
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width, canvas.height);
    const predictions = await model.estimateHands(video);
    if (predictions.length > 0) {
        drawHand(ctx, predictions[0].landmarks, predictions[0].annotations);

        handPosition = normalizeLandmark(predictions);
        let prediction = knn.classify(handPosition);
        console.log(`Signal: ${prediction}`);
        resultPrediction.innerHTML = `You're doing the '${prediction}' signal.`;

        if (gameInProgress) {
            if (prediction === currentGameSignal) {
                // Correct hand signal
                updateGameScore(1); // Increment the score by 1
                displayRandomSignal();


            }
        }
    }
    requestAnimationFrame(predictLandmarks);
}


//draw hand and fingers with x,y coordinates (ignores z-coordinate)
function drawHand(ctx, keypoints, annotations) {
    // punten op alle kootjes kan je rechtstreeks uit keypoints halen
    for (let i = 0; i < keypoints.length; i++) {
        const y = keypoints[i][0]
        const x = keypoints[i][1]
        drawPoint(ctx, x - 2, y - 2, 3)
    }

    // palmbase als laatste punt toevoegen aan elke vinger
    let palmBase = annotations.palmBase[0]
    for (let key in annotations) {
        const finger = annotations[key]
        finger.unshift(palmBase)
        drawPath(ctx, finger, false)
    }
}

//
// teken een punt
//
function drawPoint(ctx, y, x, r) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fill()
}

//
// teken een lijn
//
function drawPath(ctx, points, closePath) {
    const region = new Path2D()
    region.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length; i++) {
        const point = points[i]
        region.lineTo(point[0], point[1])
    }

    if (closePath) {
        region.closePath()
    }
    ctx.stroke(region)
}

//
// start
//
main()

function normalizeLandmark(rawObject) {
    let newObject = []

    for (const landmark of rawObject[0].landmarks) {
        newObject.push([landmark[0], landmark[1]])
    }

    for (let index = 0; index < newObject.length; index++) {
        newObject[index] = [(newObject[index][0] - rawObject[0].boundingBox.topLeft[0]),
            (newObject[index][1] - rawObject[0].boundingBox.topLeft[1])]
    }

    for (let index = 0; index < newObject.length; index++) {
        newObject[index] = [newObject[index][0] / (rawObject[0].boundingBox.bottomRight[0] - rawObject[0].boundingBox.topLeft[0]),
            newObject[index][1] / (rawObject[0].boundingBox.bottomRight[1] - rawObject[0].boundingBox.topLeft[1])]
    }

    let finalObject = []

    for (let index = 0; index < newObject.length; index++) {
        finalObject.push(newObject[index][0])
        finalObject.push(newObject[index][1])
    }

    return finalObject
}

function trainingHandler(event) {
    if (event.target.nodeName === 'BUTTON' && handPosition.length === 42) {
        knn.learn(handPosition, event.target.innerHTML)
    }
}

const playGameButton = document.getElementById("playGameButton");
playGameButton.addEventListener("click", startGame);
let randomSignal = "";

function startGame() {
    score = 0;
    const trainingSection = document.getElementById("training");
    const signals = document.getElementById("signals");
    const playGame = document.getElementById("playGameButton");
    trainingSection.style.display = "none";
    signals.style.display = "none";
    playGame.style.display = "none";

    const gameScreen = document.getElementById("gameScreen");
    gameScreen.style.display = "block";

    displayRandomSignal();
}

function displayRandomSignal() {
    const handSignals = ["Okay", "Stay there", "Going down", "Low on air"];
    randomSignal = handSignals[Math.floor(Math.random() * handSignals.length)];

    const gameResult = document.getElementById("gameResult");
    gameResult.innerHTML = `Perform the '${randomSignal}' hand signal.`;

    const gameCanvas = document.getElementById("gameCanvas");
    const gameCtx = gameCanvas.getContext("2d");
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // setTimeout(predictGameSignal, 5000, randomSignal);
    predictGameSignal(randomSignal)
}

let gameInProgress = false;
let currentGameSignal = "";

function predictGameSignal(signal) {
    gameInProgress = true;
    currentGameSignal = signal;

    if (currentGameSignal === randomSignal) {
        updateGameScore(1);
    }
}

function updateGameScore(increment) {
    if (currentGameSignal === randomSignal) {
        score += increment;
        const gameScore = document.getElementById("gameScore");
        gameScore.innerHTML = `Score: ${score}`;
    }
}



