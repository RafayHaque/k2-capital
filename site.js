// K2 Capital: shared header, footer and contact details.
// Edit SITE (contact details) and NAV (menu) here once and every page updates.

const SITE = {
  email: "k2capital@example.com",              // TODO: replace with the club email
  instagram: "https://instagram.com/k2capital.official",
  instagramHandle: "@k2capital.official",
  linkedin: "https://www.linkedin.com/",        // TODO: replace with the club LinkedIn page URL
  linktree: "https://linktr.ee/k2capital.offical",
  location: "Queen's University, Kingston, ON",
  est: "Est. February 2025",
};

const NAV = [
  ["index.html", "Home"],
  ["portfolio.html", "Portfolio"],
  ["events.html", "Events"],
  ["education.html", "Education"],
  ["about.html", "About"],
];

(function () {
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `<div class="wrap">
      <a class="brand" href="index.html" aria-label="K2 Capital home"><img src="images/logo.jpg" alt="K2 Capital logo"><span class="brand-text">K2 <span>Capital</span></span></a>
      <nav>${NAV.map(([href, label]) => `<a href="${href}" class="${page === href ? "active" : ""}">${label}</a>`).join("")}</nav>
    </div>`;
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `<div class="wrap">
      K2 Capital, Queen's University. For educational purposes only; nothing here is investment advice.
      Prices may be delayed. K2 Capital is a student club and is not an official Queen's University publication.
    </div>`;
  }

  document.querySelectorAll("[data-contact]").forEach((el) => {
    el.innerHTML = `<div class="card contact">
      <p><strong>Email</strong><br><a href="mailto:${SITE.email}">${SITE.email}</a></p>
      <p><strong>Instagram</strong><br><a href="${SITE.instagram}" rel="noopener">${SITE.instagramHandle}</a></p>
      <p><strong>LinkedIn</strong><br><a href="${SITE.linkedin}" rel="noopener">K2 Capital on LinkedIn</a></p>
      <p><strong>All links</strong><br><a href="${SITE.linktree}" rel="noopener">${SITE.linktree.replace("https://", "")}</a></p>
      <p><strong>Location</strong><br>${SITE.location}<br><span class="name">${SITE.est}</span></p>
    </div>`;
  });
})();
