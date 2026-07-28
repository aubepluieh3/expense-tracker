/**
 * 화면 껍데기. 모든 탭이 같은 패딩을 쓴다.
 *
 * 이전에는 Page 를 쓰는 화면(카테고리·설정, py-6)과 직접 section 을 쓰는
 * 화면(내역·통계, pt-4 pb-8)이 갈려서 탭을 옮기면 상단 여백이 달라졌다.
 * Page 를 만들어 놓고 절반만 쓴 결과였다.
 *
 * 내역·통계는 제목 대신 월 네비게이터가 오므로 Screen 을, 제목이 있는 화면은
 * Page 를 쓴다. Page = Screen + 제목.
 */
export function Screen({ children }: { children: React.ReactNode }) {
  return <section className="px-5 pt-4 pb-8">{children}</section>
}

export function Page({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Screen>
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      <div className="mt-4">{children}</div>
    </Screen>
  )
}
