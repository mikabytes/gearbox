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

      setInterval(checkVersion, 600 * 1000)
    }, [])

    const hasNewVersion = version !== latestVersion
    const shouldShow = localStorage.seen !== latestVersion

    if (!hasNewVersion || !shouldShow) {
      return html``
    }

    const dismiss = () => {
      localStorage.seen = latestVersion
      setSeen(latestVersion)
    }

    return html`
      <div>Version ${latestVersion} of Gearbox is now available!</div>
      <button @click=${dismiss}>✕</button>
    `
  }
)
