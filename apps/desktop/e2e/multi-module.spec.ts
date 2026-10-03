import { addProjectViaApi, test, expect } from './fixtures'

test('shows qualified Gradle and Maven application module commands', async ({
  launchDevhub,
  createProject
}) => {
  const gradle = await createProject('gradle-multi', {
    'settings.gradle.kts': 'include(":backend", ":tools")',
    'backend/build.gradle.kts': 'plugins { id("org.springframework.boot") }',
    'backend/src/main/resources/application.properties': 'server.port=18081',
    'tools/build.gradle.kts': 'plugins { id("application") }'
  })
  const maven = await createProject('maven-multi', {
    'pom.xml':
      '<project><packaging>pom</packaging><modules><module>backend</module></modules></project>',
    'backend/pom.xml':
      '<project><build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build></project>',
    'backend/src/main/resources/application.properties': 'server.port=18082'
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, gradle)
  const main = page.locator('main')
  await expect(main.getByText('gradle :backend:bootRun', { exact: true })).toBeVisible()
  await expect(main.getByText('gradle :tools:run', { exact: true })).toBeVisible()
  await expect(main.getByText('端口 18081', { exact: true })).toBeVisible()

  await addProjectViaApi(page, maven)
  await page
    .locator('aside')
    .getByRole('button', { name: /maven-multi/, exact: false })
    .first()
    .click()
  await expect(
    main.getByText('mvn -pl backend -am install -DskipTests', { exact: true })
  ).toBeVisible()
  await expect(main.getByText('mvn -pl backend spring-boot:run', { exact: true })).toBeVisible()
  await expect(main.getByText('端口 18082', { exact: true })).toBeVisible()
})
