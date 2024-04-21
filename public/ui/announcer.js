import { component, css, html, useEffect, useState } from "../component.js"

component(
  `x-announcer`,
  await css(import.meta.resolve(`./announcer.css`)),
  function Announcer() {
    const [version, setVersion] = useState(null)
    const [latestVersion, setLatestVersion] = useState(null)
    const [seen, setSeen] = useState(localStorage.seen)

    function checkVersion() {
      fetch(
        `https://raw.githubusercontent.com/mikabytes/gearbox/main/package.json`
      ).then((res) => {
        if (res.ok) {
          res.json().then((json) => {
            setLatestVersion(json.version)
          })
        }
      })

      fetch(`/version`).then((res) => {
        if (res.ok) {
          res.json().then((json) => {
            setVersion(json.version)
          })
        }
      })
    }

    useEffect(() => {
      checkVersion()

      setInterval(checkVersion, 15 * 60 * 1000)
    }, [])

    const shouldShow =
      version && latestVersion && localStorage.seen !== latestVersion

    // sometimes, github caches things and so it seems latest version is actually smaller than the current version
    if (!shouldShow || latestVersion <= version) {
      return html``
    }

    const dismiss = () => {
      localStorage.seen = latestVersion
      setSeen(latestVersion)
    }

    return html`
      <div>Version ${latestVersion} is now available!</div>
      <button @click=${dismiss}>✕</button>
    `
  }
)
