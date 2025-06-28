let player;
let playerReady = false;
let currentVideoList = videoList; // defaults to videos.js
let lastPlaylist = videoList; // previously played video list
let lastClickedButton = null; // last clicked button

function onYouTubeIframeAPIReady() {
  const video = getRandomVideo();
  player = new YT.Player("player", {
    videoId: video,
    events: {
      onReady: () => { playerReady = true; },
      onStateChange: onPlayerStateChange
    },
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1
    }
  });

  // Watch for the iframe and modify its attributes
  const observer = new MutationObserver(() => {
    const iframe = document.querySelector("#player iframe");
    if (iframe) {
      iframe.setAttribute("allow", "autoplay; fullscreen; keyboard");
      observer.disconnect(); // Stop observing once we've updated it
    }
  });

  observer.observe(document.getElementById("player"), { childList: true, subtree: true });
}

function showYearButtons() {
  console.log("Available Years:", window.availableYears);
  
  const buttonRow = document.getElementById("buttonRow");
  buttonRow.innerHTML = ""; // Clear existing buttons

  // Create container
  const yearContainer = document.createElement("div");
  yearContainer.className = "year-button-container";

  // Back button
  const backBtn = document.createElement("button");
  backBtn.textContent = "Back";
  backBtn.className = "back-button";
  backBtn.addEventListener("click", restoreMainButtons);
  yearContainer.appendChild(backBtn);

  // Year buttons
    window.availableYears.forEach((year) => {
    const btn = document.createElement("button");
    btn.textContent = year;
    btn.className = "year-button";
    btn.addEventListener("click", () => {
      const allButtons = document.querySelectorAll(".year-button");
      allButtons.forEach(b => b.classList.remove("active"));

      btn.classList.add("active");
      lastClickedButton = btn;

      loadYearVideos(year);
    });
    yearContainer.appendChild(btn);
  });

  buttonRow.replaceChildren(yearContainer);
}

function loadYearVideos(year) {
  console.log("Creating button for year:", year);

  const script = document.createElement("script");
  script.src = `byyear/${year}.js`;
  script.onload = () => {
    if (Array.isArray(window.yearVideos)) {
      currentVideoList = window.yearVideos;
      lastPlaylist = window.yearVideos;
      playRandomVideo();
    } else {
      alert("No videos found for this year.");
    }
    delete window.yearVideos;
  };
  script.onerror = () => {
    alert(`Could not load videos for ${year}.`);
  };
  document.body.appendChild(script);
}

function getRandomVideo() {
  if (!currentVideoList || currentVideoList.length === 0) return "";
  return currentVideoList[Math.floor(Math.random() * currentVideoList.length)];
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

  document.getElementById("randomBtn").addEventListener("click", () => {
    currentVideoList = videoList;
    lastPlaylist = videoList;
    lastClickedButton = document.getElementById("randomBtn");
    playRandomVideo();
  });

  document.getElementById("goldBtn").addEventListener("click", () => {
    currentVideoList = goldVideoList;
    lastPlaylist = goldVideoList;
    lastClickedButton = document.getElementById("goldBtn");
    playRandomVideo();
  });

  document.getElementById("yearBtn").addEventListener("click", showYearButtons);
});
  
const counter = document.getElementById("videoCounter");
  if (typeof videoList !== "undefined" && Array.isArray(videoList)) {
    counter.textContent = `Total Clips: ${videoList.length}`;
  } else {
    counter.textContent = `Total Clips: 0`;
  };

function restoreMainButtons() {
  const buttonRow = document.getElementById("buttonRow");
  buttonRow.innerHTML = `
    <button id="randomBtn">Play Random Clint Clips</button>
    <button id="goldBtn">Play Gold Clips</button>
    <button id="yearBtn">By Year</button>
  `;

  // Reattach event listeners
  document.getElementById("randomBtn").addEventListener("click", () => {
    currentVideoList = videoList;
    lastPlaylist = videoList;
    playRandomVideo();
  });

  document.getElementById("goldBtn").addEventListener("click", () => {
    currentVideoList = goldVideoList;
    lastPlaylist = goldVideoList;
    playRandomVideo();
  });

  document.getElementById("yearBtn").addEventListener("click", showYearButtons);
}

function toggleFullScreen() {
  const wrapper = document.getElementById("playerWrapper");
  if (!document.fullscreenElement) {
    wrapper.requestFullscreen().catch(err => {
      console.error("Fullscreen failed:", err);
    });
  } else {
    document.exitFullscreen();
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f") {
    toggleFullScreen();
  }
});

function flashButton(button) {
  if (!button) return;

  // Use different class for year buttons
  const isYear = button.classList.contains("year-button");
  const flashClass = isYear ? "flash-dark" : "flash";

  button.classList.add(flashClass);
  setTimeout(() => button.classList.remove(flashClass), 200);
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "a" && lastClickedButton) {
    playRandomVideo();

    const isYear = lastClickedButton.classList.contains("year-button");
    const flashClass = isYear ? "flash-dark" : "flash";

    lastClickedButton.classList.add(flashClass);
    setTimeout(() => {
      lastClickedButton.classList.remove(flashClass);
    }, 200);
  }

  if (key === "s") {
    currentVideoList = goldVideoList;
    lastPlaylist = goldVideoList;
    playRandomVideo();
    flashButton("goldBtn"); // Optional visual cue
  }

  if (key === "f") {
    toggleFullScreen();
  }
});