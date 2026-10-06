import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { readConnectForm, useConnection } from '@/api'
import { useColors } from '@/lib/theme'

export default function ConnectScreen(): React.JSX.Element {
  const { state, connect } = useConnection()
  const colors = useColors()
  const last = state.status === 'disconnected' ? state.last : null
  const [address, setAddress] = useState(last?.baseUrl ?? '')
  const [token, setToken] = useState(last?.token ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(state.status === 'disconnected' ? state.message : null)

  const submit = async (): Promise<void> => {
    const form = readConnectForm(address, token)
    if (!form.ok) {
      setMessage(form.message)
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      await connect(form.settings)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
      setBusy(false)
    }
  }

  const input = [styles.input, { borderColor: colors.border, color: colors.text }]
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.hint, { color: colors.muted }]}>
        在桌面端「设置 → 远程访问」中开启远程访问，然后填写地址与
        Token；也可以把二维码对应的连接地址整段粘贴到地址栏。
      </Text>
      <Text style={[styles.label, { color: colors.text }]}>地址</Text>
      <TextInput
        style={input}
        value={address}
        onChangeText={setAddress}
        placeholder="192.168.1.5:7420"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={[styles.label, { color: colors.text }]}>Token</Text>
      <TextInput
        style={input}
        value={token}
        onChangeText={setToken}
        placeholder="粘贴地址时可留空"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      {message ? <Text style={[styles.message, { color: colors.danger }]}>{message}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void submit()}
        style={[styles.button, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={{ color: colors.primaryText, fontWeight: '600' }}>
          {busy ? '正在连接…' : '连接'}
        </Text>
      </Pressable>
      <View style={styles.spacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 8 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16
  },
  message: { fontSize: 14, marginTop: 8 },
  button: { marginTop: 16, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  spacer: { height: 32 }
})
