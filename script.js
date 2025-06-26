let player;
let playerReady = false;
let currentVideoList = videoList; // default to videos.js

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
}

function showYearButtons() {
  console.log("showYearButtons triggered");
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
  for (let year = 2017; year <= 2025; year++) {
    const btn = document.createElement("button");
    btn.textContent = year;
    btn.className = "year-button";

      btn.addEventListener("click", () => { 
        // Clear active class from all buttons
        const allButtons = document.querySelectorAll(".year-button");
        allButtons.forEach(b => b.classList.remove("active"));

        // Set active class on clicked button
        btn.classList.add("active");

        // Load videos
        loadYearVideos(year);
      });
    yearContainer.appendChild(btn);
  }

  buttonRow.replaceChildren(yearContainer);
}

function loadYearVideos(year) {
  const script = document.createElement("script");
  script.src = `byyear/${year}.js`;
  script.onload = () => {
    if (Array.isArray(window.yearVideos)) {
      currentVideoList = window.yearVideos;
      playRandomVideo();
    } else {
      alert("No videos found for this year.");
    }
    // Clean up to avoid reuse
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
    playRandomVideo();
  });

  document.getElementById("goldBtn").addEventListener("click", () => {
    currentVideoList = goldVideoList;
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
    playRandomVideo();
  });

  document.getElementById("goldBtn").addEventListener("click", () => {
    currentVideoList = goldVideoList;
    playRandomVideo();
  });

  document.getElementById("yearBtn").addEventListener("click", showYearButtons);
}