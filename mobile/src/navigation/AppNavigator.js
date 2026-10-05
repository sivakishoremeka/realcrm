import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AgentOnboardingScreen from '../screens/AgentOnboardingScreen';
import PublisherPostsScreen from '../screens/PublisherPostsScreen';
import PropertyFormScreen from '../screens/PropertyFormScreen';
import AgentProfileScreen from '../screens/AgentProfileScreen';
import RequirementsScreen from '../screens/RequirementsScreen';
import RequirementFormScreen from '../screens/RequirementFormScreen';
import RequirementDetailScreen from '../screens/RequirementDetailScreen';
import AgentsDirectoryScreen from '../screens/AgentsDirectoryScreen';
import AgentDetailScreen from '../screens/AgentDetailScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CustomerFormScreen from '../screens/CustomerFormScreen';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import OwnerListingFormScreen from '../screens/OwnerListingFormScreen';
import CustomerBrowseScreen from '../screens/CustomerBrowseScreen';
import CustomerListingDetailScreen from '../screens/CustomerListingDetailScreen';
import CustomerEnquiriesScreen from '../screens/CustomerEnquiriesScreen';
import CustomerProfileScreen from '../screens/CustomerProfileScreen';
import { colors } from '../constants/theme';

const AuthStackNav = createNativeStackNavigator();
const PublisherStackNav = createNativeStackNavigator();
const AdminStackNav = createNativeStackNavigator();
const CustomerStackNav = createNativeStackNavigator();
const OnboardingStackNav = createNativeStackNavigator();
const PublisherTab = createBottomTabNavigator();
const AdminTab = createBottomTabNavigator();
const CustomerTab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '600', fontSize: 18 },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
};

// Filled icon when focused, outline otherwise
const tabIcon = (name) => ({ focused, color, size }) => (
  <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />
);

function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
    </AuthStackNav.Navigator>
  );
}

function PublisherTabs() {
  return (
    <PublisherTab.Navigator screenOptions={tabScreenOptions}>
      <PublisherTab.Screen
        name="PostsTab"
        component={PublisherPostsScreen}
        options={{ title: 'My Properties', tabBarLabel: 'Properties', tabBarIcon: tabIcon('home') }}
      />
      <PublisherTab.Screen
        name="AssignedReqs"
        component={RequirementsScreen}
        options={{ title: 'Leads', tabBarLabel: 'Leads', tabBarIcon: tabIcon('people') }}
      />
      <PublisherTab.Screen
        name="ProfileTab"
        component={AgentProfileScreen}
        options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: tabIcon('person') }}
      />
    </PublisherTab.Navigator>
  );
}

function AdminTabs() {
  return (
    <AdminTab.Navigator screenOptions={tabScreenOptions}>
      <AdminTab.Screen
        name="RequirementsTab"
        component={RequirementsScreen}
        options={{ title: 'Match', tabBarLabel: 'Match', tabBarIcon: tabIcon('git-compare') }}
      />
      <AdminTab.Screen
        name="AgentsTab"
        component={AgentsDirectoryScreen}
        options={{ title: 'Publishers', tabBarLabel: 'Publishers', tabBarIcon: tabIcon('briefcase') }}
      />
      <AdminTab.Screen
        name="CustomersTab"
        component={DashboardScreen}
        options={{ title: 'Buyers', tabBarLabel: 'Buyers', tabBarIcon: tabIcon('people') }}
      />
    </AdminTab.Navigator>
  );
}

function CustomerTabs() {
  return (
    <CustomerTab.Navigator screenOptions={tabScreenOptions}>
      <CustomerTab.Screen
        name="CustomerBrowseTab"
        component={CustomerBrowseScreen}
        options={{ title: 'Browse', tabBarLabel: 'Browse', tabBarIcon: tabIcon('search') }}
      />
      <CustomerTab.Screen
        name="CustomerEnquiriesTab"
        component={CustomerEnquiriesScreen}
        options={{ title: 'Enquiries', tabBarLabel: 'Enquiries', tabBarIcon: tabIcon('chatbubbles') }}
      />
      <CustomerTab.Screen
        name="CustomerProfileTab"
        component={CustomerProfileScreen}
        options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: tabIcon('person') }}
      />
    </CustomerTab.Navigator>
  );
}

function PublisherStack() {
  return (
    <PublisherStackNav.Navigator
      screenOptions={stackScreenOptions}
    >
      <PublisherStackNav.Screen
        name="PublisherHome"
        component={PublisherTabs}
        options={{ headerShown: false }}
      />
      <PublisherStackNav.Screen
        name="PropertyForm"
        component={PropertyFormScreen}
        options={({ route }) => ({
          title: route.params?.mode === 'edit' ? 'Edit property' : 'Add as Agent',
        })}
      />
      <PublisherStackNav.Screen
        name="OwnerListingForm"
        component={OwnerListingFormScreen}
        options={({ route }) => ({
          title: route.params?.mode === 'edit' ? 'Edit owner listing' : 'Post as Owner',
        })}
      />
      <PublisherStackNav.Screen
        name="RequirementForm"
        component={RequirementFormScreen}
        options={{ title: 'New lead' }}
      />
      <PublisherStackNav.Screen
        name="RequirementDetail"
        component={RequirementDetailScreen}
        options={{ title: 'Lead detail' }}
      />
    </PublisherStackNav.Navigator>
  );
}

function AdminStack() {
  return (
    <AdminStackNav.Navigator
      screenOptions={stackScreenOptions}
    >
      <AdminStackNav.Screen
        name="AdminHome"
        component={AdminTabs}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="RequirementForm"
        component={RequirementFormScreen}
        options={{ title: 'New requirement' }}
      />
      <AdminStackNav.Screen
        name="RequirementDetail"
        component={RequirementDetailScreen}
        options={{ title: 'Matches' }}
      />
      <AdminStackNav.Screen
        name="AgentDetail"
        component={AgentDetailScreen}
        options={{ title: 'Publisher' }}
      />
      <AdminStackNav.Screen
        name="CustomerForm"
        component={CustomerFormScreen}
        options={({ route }) => ({
          title: route.params?.mode === 'edit' ? 'Edit buyer' : 'Add buyer',
        })}
      />
      <AdminStackNav.Screen
        name="CustomerDetail"
        component={CustomerDetailScreen}
        options={{ title: 'Buyer' }}
      />
    </AdminStackNav.Navigator>
  );
}

function CustomerStack() {
  return (
    <CustomerStackNav.Navigator
      screenOptions={stackScreenOptions}
    >
      <CustomerStackNav.Screen
        name="CustomerHome"
        component={CustomerTabs}
        options={{ headerShown: false }}
      />
      <CustomerStackNav.Screen
        name="CustomerListingDetail"
        component={CustomerListingDetailScreen}
        options={{ title: 'Listing' }}
      />
    </CustomerStackNav.Navigator>
  );
}

function OnboardingStack() {
  return (
    <OnboardingStackNav.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStackNav.Screen name="Onboarding" component={AgentOnboardingScreen} />
    </OnboardingStackNav.Navigator>
  );
}

function resolveRole(role) {
  if (role === 'sales' || role === 'agent' || role === 'owner') return 'publisher';
  return role;
}

export default function AppNavigator() {
  const { isAuthenticated, booting, role, needsOnboarding } = useAuth();
  const normalizedRole = resolveRole(role);

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  let body = <AuthStack />;
  if (isAuthenticated) {
    if (normalizedRole === 'publisher' && needsOnboarding) {
      body = <OnboardingStack />;
    } else if (normalizedRole === 'admin') {
      body = <AdminStack />;
    } else if (normalizedRole === 'customer') {
      body = <CustomerStack />;
    } else if (normalizedRole === 'publisher') {
      body = <PublisherStack />;
    } else {
      body = <PublisherStack />;
    }
  }

  return <NavigationContainer theme={navTheme}>{body}</NavigationContainer>;
}
