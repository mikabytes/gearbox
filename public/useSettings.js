import { useEffect, useState } from "./component.js"
import { getSettings, subscribe, updateSettings } from "./settingsStore.js"

export default function useSettings() {
  const [settings, setSettings] = useState(getSettings())

  useEffect(() => {
    return subscribe(setSettings)
  }, [])

  return [settings, updateSettings]
}
