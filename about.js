const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const list = document.getElementById("yearList");

const results = {};
let loadedCount = 0;

years.forEach(year => {
  const script = document.createElement("script");
  script.src = `byyear/${year}.js`;

  script.onload = () => {
    const count = Array.isArray(window.yearVideos) ? window.yearVideos.length : 0;
    results[year] = `${year}: ${count} clips`;
    loadedCount++;
    delete window.yearVideos;
    checkIfAllLoaded();
  };

  script.onerror = () => {
    results[year] = `${year}: Could not load`;
    loadedCount++;
    checkIfAllLoaded();
  };

  document.body.appendChild(script);
});

function checkIfAllLoaded() {
  if (loadedCount === years.length) {
    // Sort and render in correct order
    years.forEach(year => {
      const li = document.createElement("li");
      li.textContent = results[year];
      list.appendChild(li);
    });
  }
}
