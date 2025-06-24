const videoList = [
    "https://www.youtube.com/embed/VaLYCJq-HvM",
    "https://www.youtube.com/embed/Dfzqr6b9nxM",
    "https://www.youtube.com/embed/zlH4ZvEDopA"
];

function playRandomVideo() {
  const player = document.getElementById("youtubePlayer");
  const randomIndex = Math.floor(Math.random() * videoList.length);
  player.src = videoList[randomIndex] + "?autoplay=1";
}
