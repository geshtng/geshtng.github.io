document.addEventListener("DOMContentLoaded", async () => {
    const projectsGrid = document.getElementById("projects-grid");
    try {
        const response = await fetch("../data/projects.json");
        const projects = await response.json();

        projectsGrid.innerHTML = projects.map((project) => {
            return `
                <div class="project-card">
                    <div class="project-header">
                        <i class="fas fa-code project-icon"></i>
                        <h3>${project.title}</h3>
                    </div>
                    <p>${project.description}</p>
                    <div class="tech-stack">
                        ${project.tools.map((tool) => `<span>${tool}</span>`).join("")}
                    </div>
                    <div class="project-links">
                        ${project.demo ? `<a href="${project.demo}" target="_blank" class="btn btn-sm">Live Demo</a>` : ""}
                    <a href="${project.repository}" target="_blank" class="btn btn-sm btn-outline">GitHub <i class="fab fa-github"></i></a>
                    </div>
                </div>
            `;
        }).join("");
    } catch (error) {
        console.error("Error fetching projects:", error);
    }

    const experiencesItem = document.getElementById("experience-list");
    try {
        const response = await fetch("../data/experiences.json");
        const timeline = await response.json();

        experiencesItem.innerHTML = timeline.map((item) => {
            return `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-date">${item.date}</div>
                    <div class="timeline-content">
                        <div class="company-logo">
                            <img src="${item.company_logo}" alt="Company Logo">
                        </div>
                        <div class="timeline-description">
                            <h4>${item.title}</h4>
                            <h5>${item.company}</h5>
                            <h5>${item.location}</h5>
                            <p>${item.description}</p>
                            <ul>
                                ${item.description_details.map((detail) => `<li>${detail}</li>`).join("")}
                            </ul>
                            <div class="timeline-tech-stack">
                                ${item.tools.map((tool) => `<span>${tool}</span>`).join("")}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    } catch (error) {
        console.error("Error fetching timeline:", error);
    }

    const educationsItem = document.getElementById("education-list");
    try {
        const response = await fetch("../data/educations.json");
        const timeline = await response.json();

        educationsItem.innerHTML = timeline.map((item) => {
            return `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-date">${item.date}</div>
                    <div class="timeline-content">
                        <div class="company-logo">
                            <img src="${item.institution_logo}" alt="Company Logo">
                        </div>
                        <div class="timeline-description">
                            <h4>${item.institution}</h4>
                            <h5>${item.degree} - ${item.major}</h5>
                            <h5>${item.location}</h5>
                            <p>${item.description}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    } catch (error) {
        console.error("Error fetching timeline:", error);
    }
});