import { useEffect, useState } from "./component.js"

export default function useConfig() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    let active = true
    let timer

    async function updateConfig() {
      try {
        const res = await fetch(`/config`)
        if (res.ok) {
          const newConfig = await res.json()
          if (active) setConfig(newConfig)
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (active) timer = setTimeout(updateConfig, 5000)
      }
    }
    updateConfig()

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  return config
}
