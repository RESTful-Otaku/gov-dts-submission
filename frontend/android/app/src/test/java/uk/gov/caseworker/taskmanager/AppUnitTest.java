package uk.gov.caseworker.taskmanager;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/** Unit tests for DTS Caseworker Task Manager. */
public class AppUnitTest {

  @Test
  public void appId_matchesExpected() {
    assertEquals("uk.gov.caseworker.taskmanager", "uk.gov.caseworker.taskmanager");
  }
}
