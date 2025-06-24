let player;
let playerReady = false;

const videoList = [
  "VaLYCJq-HvM",
  "Dfzqr6b9nxM",
  "zlH4ZvEDopA"
];

function onYouTubeIframeAPIReady() {
  const video = getRandomVideo();
  player = new YT.Player("player", {
    videoId: video,
    events: {
      onReady: () => {
        playerReady = true;
      },
      onStateChange: onPlayerStateChange
    },
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1
    }
  });
}

function getRandomVideo() {
  return videoList[Math.floor(Math.random() * videoList.length)];
}

function playRandomVideo() {
  if (!playerReady) return;
  const video = getRandomVideo();
  player.loadVideoById(video);
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    playRandomVideo();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("randomBtn").addEventListener("click", playRandomVideo);
});