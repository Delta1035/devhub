import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import type { UseQueryResult } from '@tanstack/react-query'
import { useColors } from './theme'

/** Loading spinner, error or empty message for a list whose query has no rows. */
export function ListState({
  query,
  empty
}: {
  query: Pick<UseQueryResult, 'isPending' | 'error'>
  empty: string
}): React.JSX.Element {
  const colors = useColors()
  return (
    <View style={styles.box}>
      {query.isPending ? (
        <ActivityIndicator />
      ) : (
        <Text style={{ color: query.error ? colors.danger : colors.muted, textAlign: 'center' }}>
          {query.error ? query.error.message : empty}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({ box: { padding: 32, alignItems: 'center' } })
