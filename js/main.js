document.getElementById("current-year").textContent = new Date().getFullYear()

const themeToggle = document.getElementById("theme-toggle")
const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)")
const moonIcon = themeToggle.querySelector(".fa-moon")
const sunIcon = themeToggle.querySelector(".fa-sun")

const getCurrentTheme = () => {
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme) {
        return savedTheme
    }
    return prefersDarkScheme.matches ? "dark" : "light"
}

const applyTheme = (theme) => {
    if (theme === "dark") {
        document.body.classList.add("dark-mode")
        moonIcon.style.display = "none"
        sunIcon.style.display = "inline-block"
    } else {
        document.body.classList.remove("dark-mode")
        moonIcon.style.display = "inline-block"
        sunIcon.style.display = "none"
    }
    localStorage.setItem("theme", theme)
}

applyTheme(getCurrentTheme())

themeToggle.addEventListener("click", () => {
    const currentTheme = getCurrentTheme()
    const newTheme = currentTheme === "dark" ? "light" : "dark"
    applyTheme(newTheme)
})

const sections = document.querySelectorAll(".section")
const navLinks = document.querySelectorAll(".menu a")

const updateActiveLink = () => {
    let currentSection = ""

    sections.forEach((section) => {
        const sectionTop = section.offsetTop - 100
        const sectionHeight = section.offsetHeight
        if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
            currentSection = section.getAttribute("id")
        }
    })

    navLinks.forEach((link) => {
        link.classList.remove("active")
        if (link.getAttribute("href") === `#${currentSection}`) {
            link.classList.add("active")
        }
    })
}

updateActiveLink()
window.addEventListener("scroll", updateActiveLink)

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault()

        const targetId = this.getAttribute("href")
        const targetElement = document.querySelector(targetId)

        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 70,
                behavior: "smooth",
            })

            history.pushState(null, null, targetId)
        }
    })
})

const menuToggle = document.getElementById("menu-toggle");
const menu = document.getElementById("menu");

menuToggle.addEventListener("click", () => {
    menu.classList.toggle("active"); // Toggle visibility
});