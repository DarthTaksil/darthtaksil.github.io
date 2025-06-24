let player;
let playerReady = false;

const videoList = [
  {
    url: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    description: "The ultimate internet classic from Rick Astley."
  },
  {
    url: "Zi_XLOBDo_Y",
    title: "Michael Jackson – Billie Jean",
    description: "Live Motown 25 performance that changed pop music forever."
  },
  {
    url: "lTRiuFIWV54",
    title: "Mario Kart 8 Deluxe Soundtrack",
    description: "Upbeat tunes from the world of Nintendo racing."
  }
];

// Called when API is ready
function onYouTubeIframeAPIReady() {
  const randomVideo = getRandomVideo();
  player = new YT.Player("player", {
    videoId: randomVideo.url,
    events: {
      onReady: () => {
        playerReady = true;
        updateVideoInfo(randomVideo);
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

// Pick a random video from the list
function getRandomVideo() {
  const randomIndex = Math.floor(Math.random() * videoList.length);
  return videoList[randomIndex];
}

// Update title and description
function updateVideoInfo(video) {
  document.getElementById("videoTitle").textContent = video.title;
  document.getElementById("videoDescription").textContent = video.description;
}

// Called when state changes (e.g. ended)
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    playRandomVideo();
  }
}

// Called by button
function playRandomVideo() {
  if (!playerReady) return; // Don't run if not ready

  const video = getRandomVideo();
  player.loadVideoById(video.url);
  updateVideoInfo(video);
}
