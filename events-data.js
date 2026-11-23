// K2 Capital: events list. Edit this file on GitHub to add, change or remove events.
// Both the Home page (next 3 upcoming) and the Events page read from here.
//
// type: "meeting" (club or public portfolio meeting), "pitch" (stock pitch), "case" (case competition)
// date: YYYY-MM-DD. time, location, link and description are optional.
// Rows marked sample: true show a "Sample" tag. Delete them once you add real events.

const EVENT_TYPES = {
  meeting: "Club meeting",
  pitch: "Stock pitch",
  case: "Case competition",
};

const EVENTS = [
  { sample: true, type: "meeting", date: "2026-12-01", time: "6:00 PM", location: "Goodes Hall, Kingston", title: "Public portfolio meeting", description: "Review of the portfolio, recent trades and what we are watching. Open to all students." },
  { sample: true, type: "pitch", date: "2026-12-08", time: "6:30 PM", location: "Goodes Hall, Kingston", title: "Associate stock pitch night", description: "Associates pitch a stock using the TILES framework. Members vote on what joins the watchlist." },
  { sample: true, type: "case", date: "2027-01-23", time: "9:00 AM", location: "Kingston, ON", title: "K2 Capital case competition", description: "Teams of four analyze a company and present a valuation to a panel.", link: "" },
  { sample: true, type: "meeting", date: "2026-11-17", time: "6:00 PM", location: "Goodes Hall, Kingston", title: "General club meeting", description: "Past event example." },
];
